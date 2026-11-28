"""複数の法人間関係にまたがる不変条件を検証する。"""

from collections import defaultdict
from collections.abc import Iterable, Mapping
from dataclasses import dataclass

from app.domain.corporate.entities import CorporateRelation
from app.domain.corporate.exceptions import (
    CorporateRelationCycleError,
    DuplicateCorporateRelationError,
    MultipleCorporateParentsError,
)
from app.domain.corporate.identifiers import CorporationId
from app.domain.corporate.value_objects import CorporateRelationType
from app.domain.foundation.value_objects import EffectiveDateRange


@dataclass(frozen=True, slots=True)
class CorporateRelationValidationRule:
    """法人間関係の種別ごとに適用する不変条件ルール。"""

    reject_reverse_duplicate: bool
    single_parent_per_target: bool
    forbid_cycles: bool


_RELATION_VALIDATION_RULES: dict[CorporateRelationType, CorporateRelationValidationRule] = {
    CorporateRelationType.PARENT_CHILD: CorporateRelationValidationRule(
        reject_reverse_duplicate=False,
        single_parent_per_target=True,
        forbid_cycles=True,
    ),
    CorporateRelationType.AFFILIATE: CorporateRelationValidationRule(
        reject_reverse_duplicate=True,
        single_parent_per_target=False,
        forbid_cycles=False,
    ),
    CorporateRelationType.FC_VC: CorporateRelationValidationRule(
        reject_reverse_duplicate=True,
        single_parent_per_target=False,
        forbid_cycles=False,
    ),
}


def _validate_relation_rules(
    rules: Mapping[CorporateRelationType, CorporateRelationValidationRule],
) -> None:
    missing = set(CorporateRelationType) - set(rules)
    if missing:
        names = ", ".join(sorted(relation_type.value for relation_type in missing))
        raise ValueError(f"CorporateRelationType に対応する検証ルールが未定義です: {names}")


_validate_relation_rules(_RELATION_VALIDATION_RULES)


def validation_rule_for(relation_type: CorporateRelationType) -> CorporateRelationValidationRule:
    """法人間関係の種別に対応する検証ルールを返す。未定義種別は ValueError。"""
    if relation_type not in _RELATION_VALIDATION_RULES:
        raise ValueError(f"未定義の法人間関係種別です: {relation_type}")
    return _RELATION_VALIDATION_RULES[relation_type]


def validate_corporate_relation(
    candidate: CorporateRelation,
    existing_relations: Iterable[CorporateRelation],
) -> None:
    """追加・訂正後の関係を、同一トランザクションで取得した最新の関係と照合する。"""
    rule = validation_rule_for(candidate.relation_type)
    period = candidate.current.period
    source = candidate.source_corporation_id
    target = candidate.target_corporation_id
    directed_edges: dict[CorporationId, list[tuple[CorporationId, EffectiveDateRange]]] = (
        defaultdict(list)
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
        if rule.reject_reverse_duplicate and (source, target) == (
            existing_target,
            existing_source,
        ):
            raise DuplicateCorporateRelationError()
        if rule.single_parent_per_target and target == existing_target:
            raise MultipleCorporateParentsError()
        if rule.forbid_cycles:
            directed_edges[existing_source].append((existing_target, existing_period))

    if rule.forbid_cycles and _reaches_source(target, source, period, directed_edges):
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
