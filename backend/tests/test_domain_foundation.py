"""domain/foundation（プリミティブ基底・EntityId・日時検証）の単体テスト。"""

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, cast

import pytest

from app.domain.foundation import (
    DomainPrimitive,
    DomainValidationError,
    EntityId,
    FiniteFloatPrimitive,
    IntPrimitive,
    MaskedPiiString,
    NonEmptyString,
    StringPrimitive,
    ensure_aware_datetime,
)


class _SampleId(EntityId):
    __slots__ = ()


class _SampleText(StringPrimitive):
    __slots__ = ()


class _SampleNonEmpty(NonEmptyString):
    __slots__ = ()


class _SamplePii(MaskedPiiString):
    __slots__ = ()


@dataclass(frozen=True, slots=True)
class _DataclassPii(MaskedPiiString):
    pass


class _SampleInt(IntPrimitive):
    __slots__ = ()


class _SampleFloat(FiniteFloatPrimitive):
    __slots__ = ()


def test_base_classes_reject_direct_instantiation() -> None:
    with pytest.raises(TypeError):
        DomainPrimitive("raw")  # type: ignore[abstract]
    with pytest.raises(TypeError):
        EntityId("id-1")
    with pytest.raises(TypeError):
        StringPrimitive("text")
    with pytest.raises(TypeError):
        NonEmptyString("text")
    with pytest.raises(TypeError):
        MaskedPiiString("text")
    with pytest.raises(TypeError):
        IntPrimitive(1)
    with pytest.raises(TypeError):
        FiniteFloatPrimitive(1.0)


def test_string_and_pii_primitives_validate_and_mask() -> None:
    assert _SampleText("").value == ""
    assert _SampleText.parse("  hello  ").value == "hello"

    assert _SampleNonEmpty.parse("  abc  ").value == "abc"
    with pytest.raises(DomainValidationError, match="空文字"):
        _SampleNonEmpty("")
    with pytest.raises(DomainValidationError, match="空文字"):
        _SampleNonEmpty(" abc ")

    pii = _SamplePii.parse("  山田 太郎  ")
    assert pii.value == "山田 太郎"
    assert str(pii) == "***"
    assert repr(pii) == "_SamplePii('***')"
    assert "山田" not in f"{pii} / {pii!r}"
    assert _SamplePii.from_value(pii) is pii
    assert _SamplePii.from_value("佐藤 花子").value == "佐藤 花子"

    dc_pii = _DataclassPii.parse("  山田 太郎  ")
    assert dc_pii.value == "山田 太郎"
    assert str(dc_pii) == "***"
    assert "山田" not in f"{dc_pii} / {dc_pii!r}"


def test_entity_id_and_numeric_primitives_and_datetime() -> None:
    parsed_id = _SampleId.parse("  corp-01_A  ")
    assert parsed_id.value == "corp-01_A"
    assert str(parsed_id) == "corp-01_A"
    with pytest.raises(DomainValidationError, match="空文字"):
        _SampleId("   ")
    with pytest.raises(DomainValidationError, match="使用できない文字"):
        _SampleId("bad/id")

    assert _SampleInt(10).value == 10
    with pytest.raises(DomainValidationError, match="整数"):
        _SampleInt(cast(Any, True))

    assert _SampleFloat.parse(2).value == 2.0
    assert _SampleFloat(0.5).value == 0.5
    with pytest.raises(DomainValidationError, match="数値"):
        _SampleFloat(cast(Any, False))
    with pytest.raises(DomainValidationError, match="有限"):
        _SampleFloat(float("nan"))
    with pytest.raises(DomainValidationError, match="有限"):
        _SampleFloat(float("inf"))

    aware = datetime(2026, 11, 25, 9, 0, tzinfo=UTC)
    assert ensure_aware_datetime(aware, field_name="created_at") == aware
    with pytest.raises(DomainValidationError, match="タイムゾーン"):
        ensure_aware_datetime(
            datetime.fromisoformat("2026-11-25T09:00:00"),
            field_name="created_at",
        )
