"""法人コンテキストの Domain Primitive。"""

import re
from dataclasses import dataclass
from typing import Self

from app.domain.foundation.exceptions import DomainValidationError
from app.domain.foundation.primitives import NonEmptyString, StringPrimitive

_MAX_NAME_LENGTH = 200
_MAX_ADDRESS_LENGTH = 500
_MAX_EVIDENCE_LENGTH = 1000
_CORPORATE_NUMBER_PATTERN = re.compile(r"[0-9]{13}")
_CONTROL_CHAR_PATTERN = re.compile(r"[\x00-\x1f\x7f]")
_MULTILINE_CONTROL_CHAR_PATTERN = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def _require_str(value: object, *, label: str, field: str) -> str:
    if not isinstance(value, str):
        raise DomainValidationError(
            f"{label}は文字列である必要があります。",
            details={"field": field},
        )
    return value


@dataclass(frozen=True, slots=True)
class CorporationName(NonEmptyString):
    """法人名（個人区分の場合は氏名・屋号等）を表す Domain Primitive。"""

    def validate(self) -> None:
        _require_str(self.value, label="法人名", field="name")
        if not self.value or self.value != self.value.strip():
            raise DomainValidationError(
                "法人名は空文字や前後の空白を指定できません。",
                details={"field": "name"},
            )
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

    @classmethod
    def parse(cls, raw: str) -> Self:
        """外部入力文字列の前後空白を除去して CorporationName を生成する。"""
        return cls(_require_str(raw, label="法人名", field="name").strip())


@dataclass(frozen=True, slots=True)
class RepresentativeName(NonEmptyString):
    """代表者名（個人区分の場合は開設者氏名）を表す Domain Primitive。"""

    def validate(self) -> None:
        _require_str(self.value, label="代表者名（開設者氏名）", field="representative_name")
        if not self.value:
            raise DomainValidationError(
                "代表者名（開設者氏名）を入力してください。",
                details={"field": "representative_name"},
            )
        if self.value != self.value.strip():
            raise DomainValidationError(
                "代表者名（開設者氏名）の前後に空白は指定できません。",
                details={"field": "representative_name"},
            )
        super().validate()
        if _CONTROL_CHAR_PATTERN.search(self.value):
            raise DomainValidationError(
                "代表者名（開設者氏名）に制御文字は使用できません。",
                details={"field": "representative_name"},
            )
        if len(self.value) > _MAX_NAME_LENGTH:
            raise DomainValidationError(
                f"代表者名（開設者氏名）は {_MAX_NAME_LENGTH} 文字以内で指定してください。",
                details={"field": "representative_name"},
            )

    @classmethod
    def parse(cls, raw: str) -> Self:
        """入力値の前後空白を除去し、必須・形式を検証して RepresentativeName を生成する。"""
        return cls(
            _require_str(raw, label="代表者名（開設者氏名）", field="representative_name").strip()
        )


@dataclass(frozen=True, slots=True)
class CorporateNumber(NonEmptyString):
    """13 桁の法人番号を表す Domain Primitive。"""

    def validate(self) -> None:
        _require_str(self.value, label="法人番号", field="corporate_number")
        if not _CORPORATE_NUMBER_PATTERN.fullmatch(self.value):
            raise DomainValidationError(
                "法人番号は 13 桁の半角数字で指定してください。",
                details={"field": "corporate_number"},
            )
        super().validate()

    @classmethod
    def parse(cls, raw: str) -> Self:
        """外部入力文字列の前後空白を除去して CorporateNumber を生成する。"""
        return cls(_require_str(raw, label="法人番号", field="corporate_number").strip())


@dataclass(frozen=True, slots=True)
class CorporateAddress(StringPrimitive):
    """法人の所在地を表す Domain Primitive。未設定時は空文字を許容する。"""

    def validate(self) -> None:
        _require_str(self.value, label="所在地", field="address")
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

    @classmethod
    def parse(cls, raw: str) -> Self:
        """外部入力文字列の前後空白を除去して CorporateAddress を生成する。"""
        return cls(_require_str(raw, label="所在地", field="address").strip())


@dataclass(frozen=True, slots=True)
class CorporationEvidence(NonEmptyString):
    """法人および法人間関係の確認・変更に用いた事実や契約の根拠メモ。"""

    def validate(self) -> None:
        _require_str(self.value, label="根拠メモ", field="evidence")
        if not self.value or self.value != self.value.strip():
            raise DomainValidationError(
                "根拠メモは空文字や前後の空白を指定できません。",
                details={"field": "evidence"},
            )
        super().validate()
        if _MULTILINE_CONTROL_CHAR_PATTERN.search(self.value):
            raise DomainValidationError(
                "根拠メモに制御文字は使用できません。",
                details={"field": "evidence"},
            )
        if len(self.value) > _MAX_EVIDENCE_LENGTH:
            raise DomainValidationError(
                f"根拠メモは {_MAX_EVIDENCE_LENGTH} 文字以内で指定してください。",
                details={"field": "evidence"},
            )

    @classmethod
    def parse(cls, raw: str) -> Self:
        """外部入力文字列の前後空白を除去して CorporationEvidence を生成する。"""
        return cls(_require_str(raw, label="根拠メモ", field="evidence").strip())
