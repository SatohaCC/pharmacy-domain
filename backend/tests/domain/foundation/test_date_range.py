"""domain/foundation の半開区間有効期間モデル EffectiveDateRange の単体テスト。"""

from dataclasses import FrozenInstanceError
from datetime import UTC, date, datetime
from typing import Any, cast

import pytest

from app.domain.foundation import DomainValidationError, EffectiveDateRange


def test_effective_date_range_creation_and_immutability() -> None:
    # Arrange & Act
    bounded = EffectiveDateRange(valid_from=date(2026, 4, 1), valid_to=date(2026, 5, 1))
    open_ended = EffectiveDateRange(valid_from=date(2026, 4, 1))

    # Assert
    assert bounded.valid_from == date(2026, 4, 1)
    assert bounded.valid_to == date(2026, 5, 1)
    assert bounded.is_open_ended is False
    assert bounded == EffectiveDateRange(date(2026, 4, 1), date(2026, 5, 1))

    assert open_ended.valid_from == date(2026, 4, 1)
    assert open_ended.valid_to is None
    assert open_ended.is_open_ended is True

    with pytest.raises(FrozenInstanceError):
        cast(Any, bounded).valid_to = date(2026, 6, 1)


def test_effective_date_range_rejects_empty_reversed_and_datetime_values() -> None:
    # Arrange
    same_day = date(2026, 4, 1)
    earlier = date(2026, 3, 31)
    later = date(2026, 5, 1)
    naive_dt = datetime(2026, 4, 1, 0, 0)  # noqa: DTZ001 - naive datetime 拒否の検証用
    aware_dt = datetime(2026, 4, 1, 0, 0, tzinfo=UTC)

    # Act & Assert: 空区間・逆転区間を拒否する。
    with pytest.raises(DomainValidationError, match="後の日付") as empty_exc:
        EffectiveDateRange(valid_from=same_day, valid_to=same_day)
    assert empty_exc.value.details == {"field": "valid_to"}

    with pytest.raises(DomainValidationError, match="後の日付") as reversed_exc:
        EffectiveDateRange(valid_from=later, valid_to=earlier)
    assert reversed_exc.value.details == {"field": "valid_to"}

    # Act & Assert: datetime（date のサブクラス）を拒否する。
    for invalid_dt in (naive_dt, aware_dt):
        with pytest.raises(DomainValidationError, match="有効開始日") as from_exc:
            EffectiveDateRange(valid_from=invalid_dt, valid_to=later)
        assert from_exc.value.details == {"field": "valid_from"}

        with pytest.raises(DomainValidationError, match="有効終了日") as to_exc:
            EffectiveDateRange(valid_from=earlier, valid_to=invalid_dt)
        assert to_exc.value.details == {"field": "valid_to"}


def test_effective_date_range_parse_accepts_iso_and_rejects_invalid_inputs() -> None:
    # Arrange & Act
    parsed_bounded = EffectiveDateRange.parse("2026-04-01", "2026-10-01")
    parsed_open = EffectiveDateRange.parse("2026-04-01")
    parsed_mixed = EffectiveDateRange.parse(date(2026, 4, 1), "2026-10-01")

    # Assert
    assert parsed_bounded == EffectiveDateRange(date(2026, 4, 1), date(2026, 10, 1))
    assert parsed_open == EffectiveDateRange(date(2026, 4, 1), None)
    assert parsed_mixed == parsed_bounded

    for invalid_str in (
        "2026/04/01",
        "20260401",
        "2026-04-01T00:00:00",
        " 2026-04-01 ",
        "not-a-date",
        "2026-02-30",
    ):
        with pytest.raises(DomainValidationError, match="YYYY-MM-DD") as exc:
            EffectiveDateRange.parse(invalid_str)
        assert exc.value.details == {"field": "valid_from"}

        with pytest.raises(DomainValidationError, match="YYYY-MM-DD") as to_exc:
            EffectiveDateRange.parse("2026-04-01", invalid_str)
        assert to_exc.value.details == {"field": "valid_to"}

    with pytest.raises(DomainValidationError, match="有効開始日"):
        EffectiveDateRange.parse(datetime(2026, 4, 1, tzinfo=UTC))


def test_effective_date_range_contains_respects_half_open_boundaries() -> None:
    # Arrange
    bounded = EffectiveDateRange(date(2026, 4, 1), date(2026, 5, 1))
    open_ended = EffectiveDateRange(date(2026, 4, 1), None)

    # Act & Assert: [valid_from, valid_to) は開始日を含み終了日を含まない。
    assert bounded.contains(date(2026, 3, 31)) is False
    assert bounded.contains(date(2026, 4, 1)) is True
    assert bounded.contains(date(2026, 4, 15)) is True
    assert bounded.contains(date(2026, 4, 30)) is True
    assert bounded.contains(date(2026, 5, 1)) is False

    assert open_ended.contains(date(2026, 3, 31)) is False
    assert open_ended.contains(date(2026, 4, 1)) is True
    assert open_ended.contains(date(2099, 12, 31)) is True

    with pytest.raises(DomainValidationError, match="日付を指定") as exc:
        bounded.contains(datetime(2026, 4, 15, tzinfo=UTC))
    assert exc.value.details == {"field": "as_of"}


def test_effective_date_range_overlaps_handles_adjacency_and_open_ended_ranges() -> None:
    # Arrange
    q1 = EffectiveDateRange(date(2026, 1, 1), date(2026, 4, 1))
    q2 = EffectiveDateRange(date(2026, 4, 1), date(2026, 7, 1))
    open_from_apr = EffectiveDateRange(date(2026, 4, 1), None)
    open_from_jan = EffectiveDateRange(date(2026, 1, 1), None)
    overlapping_one_day = EffectiveDateRange(date(2026, 1, 1), date(2026, 4, 2))
    inside = EffectiveDateRange(date(2026, 2, 1), date(2026, 3, 1))
    disjoint_later = EffectiveDateRange(date(2026, 8, 1), date(2026, 9, 1))

    # Act & Assert: 切替日 D で隣接する区間は重複しない。
    assert q1.overlaps(q2) is False
    assert q2.overlaps(q1) is False
    assert q1.overlaps(open_from_apr) is False
    assert open_from_apr.overlaps(q1) is False

    # Act & Assert: 完全に離れた区間は重複しない。
    assert q1.overlaps(disjoint_later) is False
    assert disjoint_later.overlaps(q1) is False

    # Act & Assert: 1 日重複・無期限同士・完全包含・同一区間は重複する。
    assert overlapping_one_day.overlaps(q2) is True
    assert q2.overlaps(overlapping_one_day) is True
    assert overlapping_one_day.overlaps(open_from_apr) is True
    assert open_from_apr.overlaps(overlapping_one_day) is True
    assert open_from_jan.overlaps(open_from_apr) is True
    assert open_from_apr.overlaps(open_from_jan) is True
    assert q1.overlaps(inside) is True
    assert inside.overlaps(q1) is True
    assert q1.overlaps(q1) is True


def test_effective_date_range_close_at_shortens_or_closes_and_rejects_extension() -> None:
    # Arrange
    open_ended = EffectiveDateRange(date(2026, 4, 1), None)
    bounded = EffectiveDateRange(date(2026, 4, 1), date(2027, 4, 1))

    # Act
    closed_open = open_ended.close_at(date(2026, 10, 1))
    shortened = bounded.close_at(date(2026, 10, 1))
    same_end = bounded.close_at(date(2027, 4, 1))

    # Assert: 元インスタンスは不変のまま新しい区間が返る。
    assert open_ended.valid_to is None
    assert closed_open == EffectiveDateRange(date(2026, 4, 1), date(2026, 10, 1))
    assert shortened == EffectiveDateRange(date(2026, 4, 1), date(2026, 10, 1))
    assert same_end == bounded

    # Act & Assert: 延長・開始日以前・datetime 渡しは拒否される。
    with pytest.raises(DomainValidationError, match="現在の有効終了日より後") as ext_exc:
        bounded.close_at(date(2027, 4, 2))
    assert ext_exc.value.details == {"field": "valid_to"}

    for invalid_end in (date(2026, 4, 1), date(2026, 3, 31)):
        with pytest.raises(DomainValidationError, match="有効開始日より後") as range_exc:
            open_ended.close_at(invalid_end)
        assert range_exc.value.details == {"field": "valid_to"}

    with pytest.raises(DomainValidationError, match="有効終了日") as dt_exc:
        open_ended.close_at(datetime(2026, 10, 1, tzinfo=UTC))
    assert dt_exc.value.details == {"field": "valid_to"}
