"""法人コンテキストの Domain Primitive。"""

import re
from dataclasses import dataclass

from app.domain.foundation.exceptions import DomainValidationError
from app.domain.foundation.primitives import NonEmptyString, StringPrimitive

_MAX_NAME_LENGTH = 200
_MAX_ADDRESS_LENGTH = 500
_CORPORATE_NUMBER_PATTERN = re.compile(r"[0-9]{13}")
_CONTROL_CHAR_PATTERN = re.compile(r"[\x00-\x1f\x7f]")


@dataclass(frozen=True, slots=True)
class CorporationName(NonEmptyString):
    """法人名（個人区分の場合は氏名・屋号等）を表す Domain Primitive。"""

    def validate(self) -> None:
        super().validate()
        if _CONTROL_CHAR_PATTERN.search(self.value):
            raise DomainValidationError(
                "法人名に制御文字は使用できません。",
                details={"field": "name"},
            )
        if len(self.value) > _MAX_NAME_LENGTH:
            raise DomainValidationError(
                f"法人名は {_MAX_NAME_LENGTH} 文字以内で指定してください。",
                details={"field": "name"},
            )


@dataclass(frozen=True, slots=True)
class CorporateNumber(NonEmptyString):
    """13 桁の法人番号を表す Domain Primitive。"""

    def validate(self) -> None:
        super().validate()
        if not _CORPORATE_NUMBER_PATTERN.fullmatch(self.value):
            raise DomainValidationError(
                "法人番号は 13 桁の半角数字で指定してください。",
                details={"field": "corporate_number"},
            )


@dataclass(frozen=True, slots=True)
class CorporateAddress(StringPrimitive):
    """法人の所在地を表す Domain Primitive。未設定時は空文字を許容する。"""

    def validate(self) -> None:
        super().validate()
        if self.value != self.value.strip():
            raise DomainValidationError(
                "所在地の前後に空白は指定できません。",
                details={"field": "address"},
            )
        if _CONTROL_CHAR_PATTERN.search(self.value):
            raise DomainValidationError(
                "所在地に制御文字は使用できません。",
                details={"field": "address"},
            )
        if len(self.value) > _MAX_ADDRESS_LENGTH:
            raise DomainValidationError(
                f"所在地は {_MAX_ADDRESS_LENGTH} 文字以内で指定してください。",
                details={"field": "address"},
            )
