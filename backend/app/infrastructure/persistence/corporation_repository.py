"""SQLAlchemy を用いた CorporationRepository 実装。"""

from datetime import UTC, datetime

from sqlalchemy import Connection, RowMapping, insert, select, update
from sqlalchemy.exc import IntegrityError

from app.domain.corporate.entities import Corporation
from app.domain.corporate.exceptions import (
    CorporationNotFoundError,
    DuplicateCorporateNumberError,
)
from app.domain.corporate.history import (
    CorporationChangeKind,
    CorporationEvidence,
    CorporationHistoryRecord,
)
from app.domain.corporate.identifiers import CorporationId
from app.domain.corporate.primitives import (
    CorporateAddress,
    CorporateNumber,
    CorporationName,
)
from app.domain.corporate.value_objects import CorporationCategory, CorporationStatus
from app.domain.foundation.exceptions import DomainConflictError
from app.domain.foundation.primitives import AwareDatetime
from app.domain.foundation.value_objects import EffectiveDateRange
from app.infrastructure.persistence.database import corporation_history_table, corporations_table


def _parse_iso_utc(raw: str) -> AwareDatetime:
    parsed = datetime.fromisoformat(raw)
    if parsed.tzinfo is None:
        return AwareDatetime(parsed.replace(tzinfo=UTC))
    return AwareDatetime(parsed)


def _row_to_corporation(row: RowMapping) -> Corporation:
    raw_number = row["corporate_number"]
    return Corporation(
        id=CorporationId(str(row["id"])),
        category=CorporationCategory(str(row["category"])),
        name=CorporationName(str(row["name"])),
        corporate_number=CorporateNumber(str(raw_number)) if raw_number is not None else None,
        address=CorporateAddress(str(row["address"])),
        status=CorporationStatus(str(row["status"])),
        created_at=_parse_iso_utc(str(row["created_at"])),
        updated_at=_parse_iso_utc(str(row["updated_at"])),
    )


def _row_to_history_record(row: RowMapping) -> CorporationHistoryRecord:
    value = row["corporate_number"]
    evidence = row["evidence"]
    survivor = row["surviving_corporation_id"]
    recorded_by = row["recorded_by"]
    return CorporationHistoryRecord(
        corporation=Corporation(
            id=CorporationId(row["corporation_id"]),
            category=CorporationCategory(row["category"]),
            name=CorporationName(row["name"]),
            corporate_number=CorporateNumber(value) if value is not None else None,
            address=CorporateAddress(row["address"]),
            status=CorporationStatus(row["status"]),
            created_at=_parse_iso_utc(row["created_at"]),
            updated_at=_parse_iso_utc(row["recorded_at"]),
        ),
        period=EffectiveDateRange(row["valid_from"], row["valid_to"]),
        kind=CorporationChangeKind(row["kind"]),
        evidence=CorporationEvidence(evidence) if evidence is not None else None,
        surviving_corporation_id=CorporationId(survivor) if survivor is not None else None,
        recorded_by=str(recorded_by) if recorded_by is not None else None,
    )


class SqlAlchemyCorporationRepository:
    """単一トランザクション接続上で法人集約を永続化するリポジトリ。"""

    def __init__(self, connection: Connection) -> None:
        self._connection = connection

    def add(self, corporation: Corporation) -> None:
        """新規法人を挿入する。一意制約違反時はドメイン競合例外を送出する。"""
        stmt = insert(corporations_table).values(
            id=corporation.id.value,
            category=corporation.category.value,
            name=corporation.name.value,
            corporate_number=(
                corporation.corporate_number.value
                if corporation.corporate_number is not None
                else None
            ),
            address=corporation.address.value,
            status=corporation.status.value,
            created_at=corporation.created_at.value.isoformat(),
            updated_at=corporation.updated_at.value.isoformat(),
        )
        try:
            self._connection.execute(stmt)
        except IntegrityError as exc:
            if corporation.corporate_number is not None and "corporate_number" in str(exc):
                raise DuplicateCorporateNumberError() from exc
            raise DomainConflictError(
                "法人データの登録が競合しました。",
                code="CORPORATION_CONFLICT",
                details={"resource": "corporation"},
            ) from exc

    def get(self, corporation_id: CorporationId) -> Corporation | None:
        """ID に一致する法人を取得し、ドメイン不変条件を検証して復元する。"""
        stmt = select(corporations_table).where(corporations_table.c.id == corporation_id.value)
        row = self._connection.execute(stmt).mappings().first()
        if row is None:
            return None
        return _row_to_corporation(row)

    def exists_by_corporate_number(
        self,
        corporate_number: CorporateNumber,
        *,
        exclude_id: CorporationId | None = None,
    ) -> bool:
        """同じ 13 桁法人番号を持つ法人が存在するかを返す。"""
        stmt = select(corporations_table.c.id).where(
            corporations_table.c.corporate_number == corporate_number.value
        )
        if exclude_id is not None:
            stmt = stmt.where(corporations_table.c.id != exclude_id.value)
        return self._connection.execute(stmt).first() is not None

    def save(self, corporation: Corporation) -> None:
        """既存法人の現在状態を更新する。"""
        stmt = (
            update(corporations_table)
            .where(corporations_table.c.id == corporation.id.value)
            .values(
                name=corporation.name.value,
                corporate_number=(
                    corporation.corporate_number.value
                    if corporation.corporate_number is not None
                    else None
                ),
                address=corporation.address.value,
                status=corporation.status.value,
                updated_at=corporation.updated_at.value.isoformat(),
            )
        )
        try:
            result = self._connection.execute(stmt)
        except IntegrityError as exc:
            if corporation.corporate_number is not None and "corporate_number" in str(exc):
                raise DuplicateCorporateNumberError() from exc
            raise DomainConflictError(
                "法人データの更新が競合しました。",
                code="CORPORATION_CONFLICT",
                details={"resource": "corporation"},
            ) from exc
        if result.rowcount == 0:
            raise CorporationNotFoundError()

    def history(self, corporation_id: CorporationId) -> tuple[CorporationHistoryRecord, ...]:
        """法人履歴を同じ接続から追記順に復元する。"""
        records = corporation_history_table
        stmt = (
            select(records, corporations_table.c.category, corporations_table.c.created_at)
            .join(corporations_table, records.c.corporation_id == corporations_table.c.id)
            .where(records.c.corporation_id == corporation_id.value)
            .order_by(records.c.sequence)
        )
        return tuple(
            _row_to_history_record(row) for row in self._connection.execute(stmt).mappings()
        )

    def append_history(self, record: CorporationHistoryRecord) -> None:
        """現在行と同じ接続に有効期間と記録時点を持つ変更を追加する。"""
        state = record.corporation
        number, survivor = state.corporate_number, record.surviving_corporation_id
        self._connection.execute(
            insert(corporation_history_table).values(
                corporation_id=state.id.value,
                valid_from=record.period.valid_from,
                valid_to=record.period.valid_to,
                name=state.name.value,
                corporate_number=number.value if number is not None else None,
                address=state.address.value,
                status=state.status.value,
                recorded_at=record.recorded_at.value.isoformat(),
                kind=record.kind.value,
                evidence=record.evidence.value if record.evidence is not None else None,
                surviving_corporation_id=survivor.value if survivor is not None else None,
                recorded_by=record.recorded_by,
            )
        )
