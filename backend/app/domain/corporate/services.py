"""複数の法人間関係にまたがる不変条件を検証する。"""

from collections import defaultdict
from collections.abc import Iterable

from app.domain.corporate.entities import CorporateRelation
from app.domain.corporate.exceptions import (
    CorporateRelationCycleError,
    DuplicateCorporateRelationError,
    MultipleCorporateParentsError,
)
from app.domain.corporate.identifiers import CorporationId
from app.domain.corporate.value_objects import CorporateRelationType
from app.domain.foundation.value_objects import EffectiveDateRange


def validate_corporate_relation(
    candidate: CorporateRelation,
    existing_relations: Iterable[CorporateRelation],
) -> None:
    """追加・訂正後の関係を、同一トランザクションで取得した最新の関係と照合する。"""
    period = candidate.current.period
    source = candidate.source_corporation_id
    target = candidate.target_corporation_id
    parent_edges: dict[CorporationId, list[tuple[CorporationId, EffectiveDateRange]]] = defaultdict(
        list
    )

    for relation in existing_relations:
        if relation.id == candidate.id or relation.relation_type != candidate.relation_type:
            continue
        existing_period = relation.current.period
        if not period.overlaps(existing_period):
            continue
        existing_source = relation.source_corporation_id
        existing_target = relation.target_corporation_id
        if (source, target) == (existing_source, existing_target):
            raise DuplicateCorporateRelationError()
        if candidate.relation_type == CorporateRelationType.PARENT_CHILD:
            if target == existing_target:
                raise MultipleCorporateParentsError()
            parent_edges[existing_source].append((existing_target, existing_period))
        elif (source, target) == (existing_target, existing_source):
            raise DuplicateCorporateRelationError()

    if _reaches_source(target, source, period, parent_edges):
        raise CorporateRelationCycleError()


def _reaches_source(
    target: CorporationId,
    source: CorporationId,
    period: EffectiveDateRange,
    edges: dict[CorporationId, list[tuple[CorporationId, EffectiveDateRange]]],
) -> bool:
    pending = [(target, period)]
    visited: set[tuple[CorporationId, EffectiveDateRange]] = set()
    while pending:
        node, common_period = pending.pop()
        if (node, common_period) in visited:
            continue
        if node == source:
            return True
        visited.add((node, common_period))

        for child, child_period in edges.get(node, []):
            if not common_period.overlaps(child_period):
                continue
            # すべての辺が同時に成立する期間のみを次の辺に引き継ぐ。
            end_dates = (common_period.valid_to, child_period.valid_to)
            intersection = EffectiveDateRange(
                max(common_period.valid_from, child_period.valid_from),
                min((end for end in end_dates if end is not None), default=None),
            )
            pending.append((child, intersection))
    return False
