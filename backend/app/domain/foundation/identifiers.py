"""識別子（Entity ID）の基底定義。"""

import re
from dataclasses import dataclass
from typing import Self

from app.domain.foundation.exceptions import DomainValidationError
from app.domain.foundation.primitives import DomainPrimitive

_DEFAULT_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]+$")


@dataclass(frozen=True, slots=True)
class EntityId(DomainPrimitive[str]):
    """不変かつ自己検証を行う識別子の基底クラス。"""

    def validate(self) -> None:
        if type(self) is EntityId:
            raise TypeError("EntityId は基底クラスのため直接インスタンス化できません。")
        if not isinstance(self.value, str):
            raise DomainValidationError(
                "識別子は文字列である必要があります。",
                code="INVALID_ID_TYPE",
            )
        if not self.value or not self.value.strip():
            raise DomainValidationError(
                "識別子は空文字や空白のみにできません。",
                code="INVALID_ID_FORMAT",
            )
        if not _DEFAULT_ID_PATTERN.fullmatch(self.value):
            raise DomainValidationError(
                "識別子に使用できない文字が含まれています。",
                code="INVALID_ID_FORMAT",
            )

    @classmethod
    def parse(cls, raw: str) -> Self:
        """外部入力文字列の前後空白を除去して識別子を生成する。"""
        if not isinstance(raw, str):
            raise DomainValidationError(
                "識別子の入力は文字列である必要があります。",
                code="INVALID_ID_TYPE",
            )
        return cls(raw.strip())
