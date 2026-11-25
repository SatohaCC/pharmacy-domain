"""業務非依存の Domain Primitive 基底クラスと共通検証。"""

import math
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Self, cast

from app.domain.foundation.exceptions import DomainValidationError


@dataclass(frozen=True, slots=True)
class DomainPrimitive[T](ABC):
    """不変性と値による等価性を備えた単一値 Domain Primitive の基底クラス。"""

    value: T

    def __post_init__(self) -> None:
        self.validate()

    @abstractmethod
    def validate(self) -> None:
        """不変条件を検証する。"""

    @classmethod
    def from_value(cls, value: T | Self) -> Self:
        """生の値から生成し、すでに同じ具象型であればそのまま返す。"""
        return value if isinstance(value, cls) else cls(cast(T, value))

    def __str__(self) -> str:
        return str(self.value)


@dataclass(frozen=True, slots=True)
class StringPrimitive(DomainPrimitive[str]):
    """文字列型 Domain Primitive の基底クラス。"""

    def validate(self) -> None:
        if type(self) is StringPrimitive:
            raise TypeError("StringPrimitive は基底クラスのため直接インスタンス化できません。")
        if not isinstance(self.value, str):
            raise DomainValidationError("文字列である必要があります。")

    @classmethod
    def parse(cls, raw: str) -> Self:
        """外部入力文字列の前後空白を除去してインスタンスを生成する。"""
        if not isinstance(raw, str):
            raise DomainValidationError("文字列である必要があります。")
        return cls(raw.strip())


@dataclass(frozen=True, slots=True)
class NonEmptyString(StringPrimitive):
    """空文字および前後空白を許容しない文字列 Primitive の基底クラス。"""

    def validate(self) -> None:
        if type(self) is NonEmptyString:
            raise TypeError("NonEmptyString は基底クラスのため直接インスタンス化できません。")
        super().validate()
        if not self.value or self.value != self.value.strip():
            raise DomainValidationError("空文字や前後の空白のみにできません。")


@dataclass(frozen=True, slots=True, repr=False)
class MaskedPiiString(NonEmptyString):
    """ログや例外文字列への平文漏洩を防ぐ PII マスク付き非空文字列 Primitive の基底クラス。"""

    value: str = field(repr=False)

    def validate(self) -> None:
        if type(self) is MaskedPiiString:
            raise TypeError("MaskedPiiString は基底クラスのため直接インスタンス化できません。")
        super().validate()

    def __str__(self) -> str:
        return "***"

    def __repr__(self) -> str:
        return f"{type(self).__name__}('***')"


@dataclass(frozen=True, slots=True)
class IntPrimitive(DomainPrimitive[int]):
    """真偽値を除いた整数型 Domain Primitive の基底クラス。"""

    def validate(self) -> None:
        if type(self) is IntPrimitive:
            raise TypeError("IntPrimitive は基底クラスのため直接インスタンス化できません。")
        if isinstance(self.value, bool) or not isinstance(self.value, int):
            raise DomainValidationError("整数である必要があります。")


@dataclass(frozen=True, slots=True)
class FiniteFloatPrimitive(DomainPrimitive[float]):
    """真偽値および非有限値（NaN/Inf）を除いた浮動小数点 Primitive の基底クラス。"""

    def validate(self) -> None:
        if type(self) is FiniteFloatPrimitive:
            raise TypeError("FiniteFloatPrimitive は基底クラスのため直接インスタンス化できません。")
        if isinstance(self.value, bool) or not isinstance(self.value, int | float):
            raise DomainValidationError("数値である必要があります。")
        if not math.isfinite(self.value):
            raise DomainValidationError("有限の数値である必要があります。")

    @classmethod
    def parse(cls, raw: int | float) -> Self:
        """外部入力の数値を浮動小数点として検証しインスタンスを生成する。"""
        if isinstance(raw, bool) or not isinstance(raw, int | float):
            raise DomainValidationError("数値である必要があります。")
        return cls(float(raw))


def ensure_aware_datetime(value: datetime, *, field_name: str = "datetime") -> datetime:
    """日時がタイムゾーン情報（aware）を持つことを検証して返す。"""
    if value.tzinfo is None or value.utcoffset() is None:
        raise DomainValidationError(f"{field_name} にはタイムゾーン付きの日時を指定してください。")
    return value
