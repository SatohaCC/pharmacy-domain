"""法人間関係とアプリケーション公開モデルの変換。"""

from app.application.corporate.contracts import CorporateRelationItem, CorporateRelationRevisionItem
from app.domain.corporate.entities import CorporateRelation
from app.domain.corporate.value_objects import CorporateRelationRevision


def to_revision_item(revision: CorporateRelationRevision) -> CorporateRelationRevisionItem:
    """ドメインの改訂を公開契約に変換する。"""
    return CorporateRelationRevisionItem(
        valid_from=revision.period.valid_from,
        valid_to=revision.period.valid_to,
        evidence=revision.evidence.value,
        confirmation_status=revision.confirmation_status.value,
        recorded_at=revision.recorded_at.value,
    )


def to_relation_item(
    relation: CorporateRelation, revision: CorporateRelationRevision
) -> CorporateRelationItem:
    """指定された改訂での関係の状態を公開契約に変換する。"""
    return CorporateRelationItem(
        id=relation.id.value,
        source_corporation_id=relation.source_corporation_id.value,
        target_corporation_id=relation.target_corporation_id.value,
        relation_type=relation.relation_type.value,
        valid_from=revision.period.valid_from,
        valid_to=revision.period.valid_to,
        evidence=revision.evidence.value,
        confirmation_status=revision.confirmation_status.value,
        recorded_at=revision.recorded_at.value,
    )
