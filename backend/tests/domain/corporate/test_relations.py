"""法人間関係の状態変更と、期間に基づく関係制約を検証する。"""

from dataclasses import replace
from datetime import UTC, date, datetime, timedelta, tzinfo
from typing import Any, cast

import pytest

from app.domain.corporate import (
    CorporateAddress,
    CorporateRelation,
    CorporateRelationCycleError,
    CorporateRelationId,
    CorporateRelationRevision,
    CorporateRelationType,
    Corporation,
    CorporationCategory,
    CorporationEvidence,
    CorporationId,
    CorporationName,
    CorporationStatus,
    DuplicateCorporateRelationError,
    MultipleCorporateParentsError,
    SelfCorporateRelationError,
    validate_corporate_relation,
)
from app.domain.corporate.services import (
    CorporateRelationValidationRule,
    _validate_relation_rules,
    validation_rule_for,
)
from app.domain.foundation import AwareDatetime, DomainValidationError, EffectiveDateRange

_START = date(2026, 1, 1)
_SWITCH = date(2026, 2, 1)
_RECORDED = AwareDatetime(datetime(2026, 3, 1, tzinfo=UTC))
_CORRECTED = AwareDatetime(datetime(2026, 3, 2, tzinfo=UTC))


def _relation(
    source: str,
    target: str,
    *,
    start: date = _START,
    end: date | None = None,
    kind: CorporateRelationType = CorporateRelationType.PARENT_CHILD,
    relation_id: str | None = None,
) -> CorporateRelation:
    return CorporateRelation(
        id=CorporateRelationId(relation_id or f"{source}-{target}-{kind}-{start}"),
        source_corporation_id=CorporationId(source),
        target_corporation_id=CorporationId(target),
        relation_type=kind,
        revisions=(
            CorporateRelationRevision(
                EffectiveDateRange(start, end),
                CorporationEvidence("契約書を確認"),
                _RECORDED,
            ),
        ),
    )


def test_rejects_a_relation_to_the_same_corporation() -> None:
    with pytest.raises(SelfCorporateRelationError):
        _relation("same", "same")


def test_accepts_an_individual_operator() -> None:
    operator = Corporation(
        id=CorporationId("operator"),
        category=CorporationCategory.INDIVIDUAL,
        name=CorporationName("個人開設者"),
        corporate_number=None,
        address=CorporateAddress(""),
        status=CorporationStatus.ACTIVE,
        created_at=_RECORDED,
        updated_at=_RECORDED,
    )

    relation = _relation("parent", operator.id.value)
    validate_corporate_relation(relation, ())

    assert relation.target_corporation_id == operator.id


def test_parent_can_change_at_boundary_but_not_overlap() -> None:
    old = _relation("old", "child", end=_SWITCH)
    successor = _relation("new", "child", start=_SWITCH)
    overlapping = _relation("new", "child", start=date(2026, 1, 31))

    validate_corporate_relation(successor, (old,))
    with pytest.raises(MultipleCorporateParentsError):
        validate_corporate_relation(overlapping, (old,))


def test_permits_multiple_generations_and_detects_direct_and_indirect_cycles() -> None:
    parent = _relation("parent", "child")
    child = _relation("child", "grandchild")

    validate_corporate_relation(child, (parent,))
    with pytest.raises(CorporateRelationCycleError):
        validate_corporate_relation(_relation("child", "parent"), (parent,))
    with pytest.raises(CorporateRelationCycleError):
        validate_corporate_relation(_relation("grandchild", "parent"), (parent, child))


def test_cycle_path_must_be_active_on_one_common_day() -> None:
    parent = _relation("parent", "child", end=_SWITCH)
    child = _relation("child", "grandchild", start=_SWITCH)
    historical = _relation("grandchild", "parent")

    validate_corporate_relation(historical, (parent, child))

    assert historical.current.period.overlaps(parent.current.period)
    assert historical.current.period.overlaps(child.current.period)


def test_period_correction_is_validated_against_other_relations() -> None:
    parent = _relation("parent", "child", end=_SWITCH)
    child = _relation("child", "grandchild", start=_SWITCH)
    existing = _relation("grandchild", "parent")
    correction = parent.correct(
        replace(parent.current, period=EffectiveDateRange(_START), recorded_at=_CORRECTED)
    )

    with pytest.raises(CorporateRelationCycleError):
        validate_corporate_relation(correction, (parent, child, existing))


@pytest.mark.parametrize("kind", [CorporateRelationType.AFFILIATE, CorporateRelationType.FC_VC])
def test_non_parent_relations_allow_many_partners_but_reject_overlapping_same_pair(
    kind: CorporateRelationType,
) -> None:
    existing = _relation("a", "b", kind=kind)
    other_type = _relation("a", "b")

    validate_corporate_relation(_relation("a", "c", kind=kind), (existing, other_type))
    validate_corporate_relation(_relation("a", "b", kind=kind), (other_type,))
    validate_corporate_relation(
        _relation("a", "b", kind=kind, start=_SWITCH),
        (existing.end(end_date=_SWITCH, recorded_at=_CORRECTED),),
    )
    with pytest.raises(DuplicateCorporateRelationError):
        validate_corporate_relation(
            _relation("a", "b", kind=kind, relation_id="duplicate"), (existing,)
        )
    with pytest.raises(DuplicateCorporateRelationError):
        validate_corporate_relation(_relation("b", "a", kind=kind), (existing,))


def test_ending_and_correcting_preserves_preceding_revisions() -> None:
    original = _relation("parent", "child")
    ended = original.end(end_date=_SWITCH, recorded_at=_CORRECTED)
    recorded_at = AwareDatetime(datetime(2026, 3, 3, tzinfo=UTC))

    corrected = ended.correct(
        replace(
            ended.current,
            evidence=CorporationEvidence("原契約を再確認"),
            recorded_at=recorded_at,
        )
    )

    assert corrected.id == original.id
    assert corrected.revisions[:2] == ended.revisions
    assert corrected.revision_at(_RECORDED) == original.current
    assert corrected.revision_at(_CORRECTED) == ended.current
    assert original.current.period.contains(_SWITCH)
    assert not corrected.current.period.contains(_SWITCH)
    assert corrected.current.evidence == CorporationEvidence("原契約を再確認")


def test_rejects_a_revision_with_the_same_recorded_time() -> None:
    relation = _relation("parent", "child")

    with pytest.raises(DomainValidationError, match="記録日時"):
        relation.correct(replace(relation.current, evidence=CorporationEvidence("追加資料を確認")))

    assert len(relation.revisions) == 1


class _RepeatedHour(tzinfo):
    def utcoffset(self, value: datetime | None) -> timedelta:
        fold = value.fold if value is not None else 0
        return timedelta(hours=-4 - fold)

    def dst(self, value: datetime | None) -> timedelta:
        return self.utcoffset(value) + timedelta(hours=5)

    def tzname(self, value: datetime | None) -> str:
        return "DST" if self.dst(value) else "STD"


def test_revision_order_compares_instants_across_a_repeated_local_hour() -> None:
    timezone = _RepeatedHour()
    earlier = AwareDatetime(datetime(2026, 11, 1, 1, 50, tzinfo=timezone, fold=0))
    later = AwareDatetime(datetime(2026, 11, 1, 1, 10, tzinfo=timezone, fold=1))
    relation = _relation("parent", "child")
    relation = replace(relation, revisions=(replace(relation.current, recorded_at=earlier),))

    revised = relation.correct(replace(relation.current, recorded_at=later))

    assert revised.revision_at(earlier) == relation.current
    assert revised.revision_at(later) == revised.current


def test_every_relation_type_has_explicit_validation_rule_and_rejects_unclassified() -> None:
    assert validation_rule_for(
        CorporateRelationType.PARENT_CHILD
    ) == CorporateRelationValidationRule(
        reject_reverse_duplicate=False,
        single_parent_per_target=True,
        forbid_cycles=True,
    )
    for symmetric_type in (CorporateRelationType.AFFILIATE, CorporateRelationType.FC_VC):
        assert validation_rule_for(symmetric_type) == CorporateRelationValidationRule(
            reject_reverse_duplicate=True,
            single_parent_per_target=False,
            forbid_cycles=False,
        )

    with pytest.raises(ValueError, match="未定義"):
        _validate_relation_rules(
            {
                CorporateRelationType.PARENT_CHILD: CorporateRelationValidationRule(
                    reject_reverse_duplicate=False,
                    single_parent_per_target=True,
                    forbid_cycles=True,
                )
            }
        )

    with pytest.raises(ValueError, match="未定義"):
        validation_rule_for(cast(Any, "unknown"))
