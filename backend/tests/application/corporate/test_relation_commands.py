"""法人間関係の訂正ユースケースが記録順を維持することを検証する。"""

from datetime import UTC, date, datetime, timedelta
from unittest.mock import Mock

from app.application.corporate.contracts import CorrectCorporateRelationInput
from app.application.corporate.relation_commands import CorporateRelationCommandService
from app.domain.corporate import (
    CorporateRelation,
    CorporateRelationId,
    CorporateRelationRevision,
    CorporateRelationType,
    CorporationEvidence,
    CorporationId,
)
from app.domain.foundation import AwareDatetime, EffectiveDateRange
from tests.application.corporate.test_use_cases import _FixedClock, _SequentialIdGenerator


def test_evidence_correction_gets_a_later_timestamp_even_with_a_fixed_clock() -> None:
    now = datetime(2026, 1, 1, tzinfo=UTC)
    period = EffectiveDateRange(date(2025, 1, 1))
    original = CorporateRelation(
        CorporateRelationId("relation-id"),
        CorporationId("a"),
        CorporationId("b"),
        CorporateRelationType.AFFILIATE,
        (
            CorporateRelationRevision(
                period,
                CorporationEvidence("初回"),
                AwareDatetime(now),
            ),
        ),
    )
    uow = Mock()
    context = Mock()
    context.__enter__ = Mock(return_value=uow)
    context.__exit__ = Mock(return_value=None)
    uow.relations.get.return_value = original
    uow.relations.list_overlapping.return_value = (original,)
    service = CorporateRelationCommandService(
        uow_factory=lambda: context, clock=_FixedClock(now), id_generator=_SequentialIdGenerator()
    )

    result = service.correct_relation(
        original.id.value, CorrectCorporateRelationInput(evidence="訂正")
    )

    assert result.evidence == "訂正"
    assert result.recorded_at == now + timedelta(microseconds=1)
    saved = uow.relations.save.call_args.args[0]
    assert saved.revisions[0] == original.current
    assert saved.current.period == period
    uow.commit.assert_called_once()
