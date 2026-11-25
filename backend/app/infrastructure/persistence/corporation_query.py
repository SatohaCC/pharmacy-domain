"""SQLAlchemy を用いた CorporationQueryPort 実装。"""

from datetime import UTC, datetime

from sqlalchemy import Engine, RowMapping, func, or_, select, text

from app.application.corporate.contracts import (
    CorporationItem,
    CorporationListResult,
    ListCorporationsQuery,
)
from app.domain.corporate.history import CorporationHistoryRecord
from app.domain.corporate.identifiers import CorporationId
from app.infrastructure.persistence.corporation_repository import SqlAlchemyCorporationRepository
from app.infrastructure.persistence.database import corporations_table


def _parse_iso_utc(raw: str) -> datetime:
    parsed = datetime.fromisoformat(raw)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed


def _row_to_item(row: RowMapping) -> CorporationItem:
    raw_number = row["corporate_number"]
    return CorporationItem(
        id=str(row["id"]),
        category=str(row["category"]),
        name=str(row["name"]),
        corporate_number=str(raw_number) if raw_number is not None else None,
        address=str(row["address"]),
        status=str(row["status"]),
        created_at=_parse_iso_utc(str(row["created_at"])),
        updated_at=_parse_iso_utc(str(row["updated_at"])),
    )


class SqlAlchemyCorporationQueryPort:
    """法人の読み取り投影と検索を担うクエリポート実装。"""

    def __init__(self, engine: Engine) -> None:
        self._engine = engine

    def get_corporation(self, corporation_id: str) -> CorporationItem | None:
        """ID に一致する法人投影を返す。"""
        stmt = select(corporations_table).where(corporations_table.c.id == corporation_id)
        with self._engine.connect() as connection:
            row = connection.execute(stmt).mappings().first()
        if row is None:
            return None
        return _row_to_item(row)

    def list_corporations(self, query: ListCorporationsQuery) -> CorporationListResult:
        """検索条件に一致する法人投影一覧を作成日時降順で返す。"""
        stmt = select(corporations_table)
        if query.category is not None:
            stmt = stmt.where(corporations_table.c.category == query.category)
        if query.status is not None:
            stmt = stmt.where(corporations_table.c.status == query.status)
        if query.query is not None:
            stmt = stmt.where(
                or_(
                    func.unicode_contains(corporations_table.c.name, query.query),
                    func.unicode_contains(corporations_table.c.address, query.query),
                    func.unicode_contains(corporations_table.c.corporate_number, query.query),
                )
            )
        stmt = stmt.order_by(corporations_table.c.created_at.desc(), text("rowid DESC"))

        with self._engine.connect() as connection:
            rows = connection.execute(stmt).mappings().all()

        items = tuple(_row_to_item(row) for row in rows)
        return CorporationListResult(items=items, total=len(items))

    def get_history(
        self, corporation_id: CorporationId
    ) -> tuple[CorporationHistoryRecord, ...] | None:
        """法人の存在と履歴を同じ読み取りトランザクションで取得する。"""
        with self._engine.connect() as connection:
            repository = SqlAlchemyCorporationRepository(connection)
            if repository.get(corporation_id) is None:
                return None
            return repository.history(corporation_id)
