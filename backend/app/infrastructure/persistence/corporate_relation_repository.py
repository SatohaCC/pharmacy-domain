"""SQLAlchemy を用いて法人間関係と改訂を永続化する。"""

from datetime import UTC, date
from typing import Any

from sqlalchemy import Connection, RowMapping, Select, func, insert, or_, select
from sqlalchemy.exc import IntegrityError

from app.domain.corporate import (
    CorporateRelation,
    CorporateRelationId,
    CorporateRelationRevision,
    CorporateRelationType,
    CorporationId,
    RelationEvidence,
)
from app.domain.foundation import AwareDatetime, DomainConflictError, EffectiveDateRange
from app.infrastructure.persistence.database import (
    corporate_relation_revisions_table as revisions,
)
from app.infrastructure.persistence.database import corporate_relations_table as relations


def _stored_time(value: AwareDatetime) -> str:
    return value.value.astimezone(UTC).isoformat(timespec="microseconds")


def _revision(row: RowMapping) -> CorporateRelationRevision:
    recorded_by = row["recorded_by"]
    return CorporateRelationRevision(
        EffectiveDateRange(row["valid_from"], row["valid_to"]),
        RelationEvidence(row["evidence"]),
        AwareDatetime.parse(row["recorded_at"]),
        recorded_by=str(recorded_by) if recorded_by is not None else None,
    )


def _relation(
    first: RowMapping, records: tuple[CorporateRelationRevision, ...]
) -> CorporateRelation:
    return CorporateRelation(
        CorporateRelationId(first["id"]),
        CorporationId(first["source_corporation_id"]),
        CorporationId(first["target_corporation_id"]),
        CorporateRelationType(first["relation_type"]),
        records,
    )


def _latest_revisions(cutoff: AwareDatetime | None = None) -> Select[Any]:
    latest = select(
        revisions.c.relation_id, func.max(revisions.c.recorded_at).label("recorded_at")
    ).group_by(revisions.c.relation_id)
    if cutoff is not None:
        latest = latest.where(revisions.c.recorded_at <= _stored_time(cutoff))
    ranked = latest.subquery()
    return (
        select(relations, revisions)
        .join(revisions, revisions.c.relation_id == relations.c.id)
        .join(
            ranked,
            (ranked.c.relation_id == revisions.c.relation_id)
            & (ranked.c.recorded_at == revisions.c.recorded_at),
        )
    )


class SqlAlchemyCorporateRelationRepository:
    """操作単位の SQL 接続を使い、関係の改訂を追記する。"""

    def __init__(self, connection: Connection) -> None:
        self._connection = connection

    def add(self, relation: CorporateRelation) -> None:
        """関係と最初の改訂を永続化する。"""
        try:
            self._connection.execute(
                insert(relations).values(
                    id=relation.id.value,
                    source_corporation_id=relation.source_corporation_id.value,
                    target_corporation_id=relation.target_corporation_id.value,
                    relation_type=relation.relation_type.value,
                )
            )
            for revision in relation.revisions:
                self._append(relation.id, revision)
        except IntegrityError as exc:
            raise DomainConflictError(
                "法人間関係の登録が競合しました。", code="CORPORATE_RELATION_CONFLICT"
            ) from exc

    def get(self, relation_id: CorporateRelationId) -> CorporateRelation | None:
        """識別子で、記録時刻で整列した関係の全履歴を取得する。"""
        statement = (
            select(relations, revisions)
            .join(revisions, revisions.c.relation_id == relations.c.id)
            .where(relations.c.id == relation_id.value)
            .order_by(revisions.c.recorded_at)
        )
        rows = self._connection.execute(statement).mappings().all()
        return _relation(rows[0], tuple(_revision(row) for row in rows)) if rows else None

    def list_overlapping(self, period: EffectiveDateRange) -> tuple[CorporateRelation, ...]:
        """最新の改訂の中から候補と有効期間が重複する関係を読み取る。"""
        statement = _latest_revisions().where(
            or_(revisions.c.valid_to.is_(None), revisions.c.valid_to > period.valid_from)
        )
        if period.valid_to is not None:
            statement = statement.where(revisions.c.valid_from < period.valid_to)
        return self._list(statement)

    def list_relations(
        self,
        corporation_id: CorporationId | None,
        as_of: date | None,
        recorded_as_of: AwareDatetime | None,
        relation_type: CorporateRelationType | None = None,
    ) -> tuple[CorporateRelation, ...]:
        """指定の記録時点から見た有効な関係を取得する。"""
        statement = _latest_revisions(recorded_as_of)
        if corporation_id is not None:
            statement = statement.where(
                or_(
                    relations.c.source_corporation_id == corporation_id.value,
                    relations.c.target_corporation_id == corporation_id.value,
                )
            )
        if as_of is not None:
            statement = statement.where(
                revisions.c.valid_from <= as_of,
                or_(revisions.c.valid_to.is_(None), revisions.c.valid_to > as_of),
            )
        if relation_type is not None:
            statement = statement.where(relations.c.relation_type == relation_type.value)
        return self._list(statement)

    def save(self, relation: CorporateRelation) -> None:
        """最新の訂正・終了記録を追加する。"""
        try:
            self._append(relation.id, relation.current)
        except IntegrityError as exc:
            raise DomainConflictError(
                "法人間関係の更新が競合しました。", code="CORPORATE_RELATION_CONFLICT"
            ) from exc

    def _append(
        self, relation_id: CorporateRelationId, revision: CorporateRelationRevision
    ) -> None:
        self._connection.execute(
            insert(revisions).values(
                relation_id=relation_id.value,
                recorded_at=_stored_time(revision.recorded_at),
                valid_from=revision.period.valid_from,
                valid_to=revision.period.valid_to,
                evidence=revision.evidence.value,
                recorded_by=revision.recorded_by,
            )
        )

    def _list(self, statement: Select[Any]) -> tuple[CorporateRelation, ...]:
        rows = self._connection.execute(statement.order_by(relations.c.id)).mappings()
        return tuple(_relation(row, (_revision(row),)) for row in rows)
