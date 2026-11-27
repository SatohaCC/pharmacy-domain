"""法人間関係の現在と過去の記録を参照する。"""

from datetime import UTC, datetime

from app.application.corporate.contracts import (
    CorporateRelationItem,
    CorporateRelationRevisionItem,
    ListCorporateRelationsQuery,
)
from app.application.corporate.ports import CorporateRelationQueryGateway
from app.application.corporate.relation_mappers import to_relation_item, to_revision_item
from app.application.foundation.error_mappers import from_domain_error
from app.domain.corporate import (
    CorporateRelation,
    CorporateRelationId,
    CorporateRelationNotFoundError,
    CorporateRelationType,
    CorporationId,
    RelationConfirmationStatus,
)
from app.domain.foundation import AwareDatetime, DomainError, DomainValidationError


def _recorded_cutoff(value: datetime) -> AwareDatetime:
    timestamp = AwareDatetime(value)
    try:
        return AwareDatetime(timestamp.value.astimezone(UTC))
    except OverflowError as exc:
        raise DomainValidationError(
            "記録日時が UTC で扱える範囲を超えています。", details={"field": "recorded_as_of"}
        ) from exc


class CorporateRelationQueryService:
    """指定の有効日・記録日時から法人間関係を取得する。"""

    def __init__(self, query_gateway: CorporateRelationQueryGateway) -> None:
        self._query_gateway = query_gateway

    def list_relations(
        self, query: ListCorporateRelationsQuery
    ) -> tuple[CorporateRelationItem, ...]:
        """両端の法人 ID と時点条件に一致する法人間関係を取得する。"""
        try:
            corporation_id = (
                CorporationId.parse(query.corporation_id)
                if query.corporation_id is not None
                else None
            )
            recorded = (
                _recorded_cutoff(query.recorded_as_of) if query.recorded_as_of is not None else None
            )
            relation_type = (
                CorporateRelationType(query.relation_type)
                if query.relation_type is not None
                else None
            )
            confirmation_status = (
                RelationConfirmationStatus(query.confirmation_status)
                if query.confirmation_status is not None
                else None
            )
            relations = self._query_gateway.list_relations(
                corporation_id,
                query.as_of,
                recorded,
                relation_type,
                confirmation_status,
            )
        except DomainError as exc:
            raise from_domain_error(exc) from exc
        return tuple(to_relation_item(relation, relation.current) for relation in relations)

    def get_relation(
        self, relation_id: str, recorded_as_of: datetime | None = None
    ) -> CorporateRelationItem:
        """詳細と指定された記録時点での内容を取得する。"""
        try:
            relation = self._get_relation(relation_id)
            revision = (
                relation.current
                if recorded_as_of is None
                else relation.revision_at(_recorded_cutoff(recorded_as_of))
            )
            if revision is None:
                raise CorporateRelationNotFoundError()
        except DomainError as exc:
            raise from_domain_error(exc) from exc
        return to_relation_item(relation, revision)

    def list_revisions(self, relation_id: str) -> tuple[CorporateRelationRevisionItem, ...]:
        """過去の改訂を記録日時の昇順で取得する。"""
        try:
            relation = self._get_relation(relation_id)
        except DomainError as exc:
            raise from_domain_error(exc) from exc
        return tuple(to_revision_item(revision) for revision in relation.revisions)

    def _get_relation(self, relation_id: str) -> CorporateRelation:
        relation = self._query_gateway.get(CorporateRelationId.parse(relation_id))
        if relation is None:
            raise CorporateRelationNotFoundError()
        return relation
