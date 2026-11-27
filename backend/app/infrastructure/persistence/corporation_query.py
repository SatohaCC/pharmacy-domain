"""SQLAlchemy を用いた CorporationQueryPort 実装。"""

from datetime import UTC, date, datetime, timedelta, timezone

import sqlalchemy as sa
from sqlalchemy import Engine, RowMapping, func, or_, select, text

from app.application.corporate.contracts import (
    CorporationItem,
    CorporationListResult,
    ListCorporationsQuery,
)
from app.domain.corporate.history import CorporationHistory, CorporationHistoryRecord
from app.domain.corporate.identifiers import CorporationId
from app.infrastructure.persistence.corporation_repository import (
    SqlAlchemyCorporationRepository,
    _row_to_history_record,
)
from app.infrastructure.persistence.database import corporation_history_table, corporations_table

_JAPAN_TIME = timezone(timedelta(hours=9))


def _parse_iso_utc(raw: str) -> datetime:
    parsed = datetime.fromisoformat(raw)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed


def _row_to_item(
    row: RowMapping,
    *,
    valid_from: date | None = None,
    valid_to: date | None = None,
) -> CorporationItem:
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
        valid_from=valid_from,
        valid_to=valid_to,
        usage_status=str(row["usage_status"]),
    )


def _current_periods_by_corporation_id(
    connection: sa.Connection,
    corporation_ids: list[str],
    today: date,
) -> dict[str, tuple[date, date | None]]:
    if not corporation_ids:
        return {}
    stmt = (
        select(
            corporation_history_table,
            corporations_table.c.category,
            corporations_table.c.created_at,
        )
        .join(
            corporations_table,
            corporation_history_table.c.corporation_id == corporations_table.c.id,
        )
        .where(corporation_history_table.c.corporation_id.in_(corporation_ids))
        .order_by(corporation_history_table.c.corporation_id, corporation_history_table.c.sequence)
    )
    grouped: dict[str, list[CorporationHistoryRecord]] = {}
    for row in connection.execute(stmt).mappings():
        corp_id = str(row["corporation_id"])
        grouped.setdefault(corp_id, []).append(_row_to_history_record(row))

    periods: dict[str, tuple[date, date | None]] = {}
    for corp_id, records in grouped.items():
        history = CorporationHistory(tuple(records))
        current = history.at(today) or records[-1]
        periods[corp_id] = (current.period.valid_from, current.period.valid_to)
    return periods


class SqlAlchemyCorporationQueryPort:
    """法人の読み取り投影と検索を担うクエリポート実装。"""

    def __init__(self, engine: Engine) -> None:
        self._engine = engine

    def get_corporation(self, corporation_id: str) -> CorporationItem | None:
        """ID に一致する法人投影を返す。"""
        stmt = select(corporations_table).where(corporations_table.c.id == corporation_id)
        today = datetime.now(_JAPAN_TIME).date()
        with self._engine.connect() as connection:
            row = connection.execute(stmt).mappings().first()
            if row is None:
                return None
            periods = _current_periods_by_corporation_id(connection, [corporation_id], today)
        valid_from, valid_to = periods.get(corporation_id, (None, None))
        return _row_to_item(row, valid_from=valid_from, valid_to=valid_to)

    def list_corporations(self, query: ListCorporationsQuery) -> CorporationListResult:
        """検索条件に一致する法人投影一覧を作成日時降順で返す。"""
        is_sqlite = self._engine.dialect.name == "sqlite"
        stmt = select(corporations_table)
        if query.category is not None:
            stmt = stmt.where(corporations_table.c.category == query.category)
        if query.status is not None:
            stmt = stmt.where(corporations_table.c.status == query.status)
        if query.usage_status is not None:
            stmt = stmt.where(corporations_table.c.usage_status == query.usage_status)
        if query.query is not None:
            if is_sqlite:
                stmt = stmt.where(
                    or_(
                        func.unicode_contains(corporations_table.c.name, query.query),
                        func.unicode_contains(corporations_table.c.address, query.query),
                        func.unicode_contains(corporations_table.c.corporate_number, query.query),
                    )
                )
            else:
                escaped = query.query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
                pattern = f"%{escaped}%"
                stmt = stmt.where(
                    or_(
                        corporations_table.c.name.ilike(pattern, escape="\\"),
                        corporations_table.c.address.ilike(pattern, escape="\\"),
                        corporations_table.c.corporate_number.ilike(pattern, escape="\\"),
                    )
                )
        if is_sqlite:
            stmt = stmt.order_by(corporations_table.c.created_at.desc(), text("rowid DESC"))
        else:
            stmt = stmt.order_by(
                corporations_table.c.created_at.desc(),
                corporations_table.c.id.desc(),
            )

        today = datetime.now(_JAPAN_TIME).date()
        with self._engine.connect() as connection:
            rows = connection.execute(stmt).mappings().all()
            periods = _current_periods_by_corporation_id(
                connection, [str(row["id"]) for row in rows], today
            )

        items = tuple(
            _row_to_item(
                row,
                valid_from=periods.get(str(row["id"]), (None, None))[0],
                valid_to=periods.get(str(row["id"]), (None, None))[1],
            )
            for row in rows
        )
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
