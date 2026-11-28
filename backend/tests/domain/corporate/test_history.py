"""法人履歴の有効期間と記録日時の境界を検証する。"""

from dataclasses import replace
from datetime import UTC, date, datetime
from typing import Any, cast

import pytest

from app.domain.corporate.entities import Corporation
from app.domain.corporate.exceptions import InvalidCorporationTransitionError
from app.domain.corporate.history import (
    CorporationChangeKind,
    CorporationHistory,
    CorporationHistoryRecord,
    CorporationStatusTransition,
    _validate_status_change_kinds,
    status_change_kind_for,
)
from app.domain.corporate.identifiers import CorporationId
from app.domain.corporate.primitives import CorporateAddress, CorporationEvidence, CorporationName
from app.domain.corporate.value_objects import (
    CorporationCategory,
    CorporationStatus,
    CorporationUsageStatus,
)
from app.domain.foundation import AwareDatetime, EffectiveDateRange


def test_later_bounded_correction_only_changes_its_visible_interval() -> None:
    initial_time = AwareDatetime(datetime(2026, 1, 1, tzinfo=UTC))
    correction_time = AwareDatetime(datetime(2026, 1, 3, tzinfo=UTC))
    start = date(2025, 1, 1)
    correction_start = date(2025, 3, 1)
    correction_end = date(2025, 4, 1)
    original = Corporation(
        id=CorporationId("corporation"),
        category=CorporationCategory.CORPORATION,
        name=CorporationName("当初の名称"),
        corporate_number=None,
        address=CorporateAddress(""),
        status=CorporationStatus.ACTIVE,
        created_at=initial_time,
        updated_at=initial_time,
    )
    history = CorporationHistory(
        (
            CorporationHistoryRecord(
                original,
                EffectiveDateRange(start),
                CorporationChangeKind.REGISTRATION,
            ),
            CorporationHistoryRecord(
                replace(original, name=CorporationName("訂正した名称"), updated_at=correction_time),
                EffectiveDateRange(correction_start, correction_end),
                CorporationChangeKind.CORRECTION,
            ),
        )
    )

    old_view = history.at(correction_start, initial_time)
    before = history.at(date(2025, 2, 28))
    corrected = history.at(correction_start)
    after = history.at(correction_end)

    assert old_view is not None and old_view.period == EffectiveDateRange(start)
    assert before is not None and before.period == EffectiveDateRange(start, correction_start)
    assert corrected is not None and corrected.corporation.name.value == "訂正した名称"
    assert after is not None and after.period == EffectiveDateRange(correction_end)
    assert after.corporation == original


@pytest.mark.parametrize(
    ("target_status", "expected_kind"),
    [
        (CorporationStatus.DISSOLVED, CorporationChangeKind.DISSOLUTION),
        (CorporationStatus.MERGED_OUT, CorporationChangeKind.MERGER),
    ],
)
def test_record_status_returns_aligned_corporation_and_history_record(
    target_status: CorporationStatus,
    expected_kind: CorporationChangeKind,
) -> None:
    initial_time = AwareDatetime(datetime(2026, 1, 1, tzinfo=UTC))
    transition_time = AwareDatetime(datetime(2026, 2, 1, tzinfo=UTC))
    start = date(2025, 1, 1)
    effective_date = date(2025, 4, 1)
    original = Corporation(
        id=CorporationId("corp-1"),
        category=CorporationCategory.CORPORATION,
        name=CorporationName("株式会社さくら薬局"),
        corporate_number=None,
        address=CorporateAddress("東京都新宿区"),
        status=CorporationStatus.ACTIVE,
        created_at=initial_time,
        updated_at=initial_time,
        usage_status=CorporationUsageStatus.ACTIVE,
    )
    history = CorporationHistory(
        (
            CorporationHistoryRecord(
                original,
                EffectiveDateRange(start),
                CorporationChangeKind.REGISTRATION,
            ),
        )
    )

    transition = history.record_status(
        original,
        target_status,
        effective_date=effective_date,
        recorded_at=transition_time,
        evidence=CorporationEvidence("登記簿を確認"),
        surviving_corporation_id=(
            CorporationId("corp-2") if target_status == CorporationStatus.MERGED_OUT else None
        ),
        recorded_by="user-1",
    )

    assert isinstance(transition, CorporationStatusTransition)
    assert transition.corporation.status == target_status
    assert transition.corporation.usage_status == CorporationUsageStatus.SUSPENDED
    assert transition.corporation.updated_at == transition_time
    assert transition.record.kind == expected_kind
    assert transition.record.kind.is_status_change is True
    assert transition.record.corporation.status == target_status
    assert transition.record.corporation.usage_status == CorporationUsageStatus.SUSPENDED
    assert transition.record.recorded_at == transition_time

    restored = history.append(transition.record).at(effective_date)
    assert restored is not None
    assert restored.kind == expected_kind
    assert restored.corporation.status == target_status
    assert restored.corporation.usage_status == CorporationUsageStatus.SUSPENDED


def test_status_change_kind_mapping_validation_and_change_kind_requirements() -> None:
    assert status_change_kind_for(CorporationStatus.ACTIVE) is None
    assert status_change_kind_for(CorporationStatus.DISSOLVED) is CorporationChangeKind.DISSOLUTION
    assert status_change_kind_for(CorporationStatus.MERGED_OUT) is CorporationChangeKind.MERGER

    with pytest.raises(ValueError, match="未定義"):
        status_change_kind_for(cast(Any, "unknown"))

    with pytest.raises(ValueError, match="未定義"):
        _validate_status_change_kinds({CorporationStatus.ACTIVE: None})

    with pytest.raises(ValueError, match="状態変更ではない履歴種別"):
        _validate_status_change_kinds(
            {
                CorporationStatus.ACTIVE: None,
                CorporationStatus.DISSOLVED: CorporationChangeKind.PROFILE,
                CorporationStatus.MERGED_OUT: CorporationChangeKind.MERGER,
            }
        )

    new_member = cast(Any, CorporationChangeKind)._new_member_
    with pytest.raises(TypeError, match="is_status_change"):
        new_member(CorporationChangeKind, "broken")

    with pytest.raises(TypeError, match="is_status_change"):
        new_member(CorporationChangeKind, "broken", "yes")

    initial_time = AwareDatetime(datetime(2026, 1, 1, tzinfo=UTC))
    corp = Corporation(
        id=CorporationId("corp-1"),
        category=CorporationCategory.CORPORATION,
        name=CorporationName("株式会社さくら薬局"),
        corporate_number=None,
        address=CorporateAddress("東京都新宿区"),
        status=CorporationStatus.ACTIVE,
        created_at=initial_time,
        updated_at=initial_time,
    )
    history = CorporationHistory(
        (
            CorporationHistoryRecord(
                corp,
                EffectiveDateRange(date(2025, 1, 1)),
                CorporationChangeKind.REGISTRATION,
            ),
        )
    )
    with pytest.raises(InvalidCorporationTransitionError):
        history.record_status(
            corp,
            CorporationStatus.ACTIVE,
            effective_date=date(2025, 2, 1),
            recorded_at=AwareDatetime(datetime(2026, 2, 1, tzinfo=UTC)),
            evidence=None,
            surviving_corporation_id=None,
        )
