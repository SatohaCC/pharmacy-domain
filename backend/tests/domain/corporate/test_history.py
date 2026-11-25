"""法人履歴の有効期間と記録日時の境界を検証する。"""

from dataclasses import replace
from datetime import UTC, date, datetime

from app.domain.corporate.entities import Corporation
from app.domain.corporate.history import (
    CorporationChangeKind,
    CorporationHistory,
    CorporationHistoryRecord,
)
from app.domain.corporate.identifiers import CorporationId
from app.domain.corporate.primitives import CorporateAddress, CorporationName
from app.domain.corporate.value_objects import CorporationCategory, CorporationStatus
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
