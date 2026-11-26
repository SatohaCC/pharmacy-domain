"""共通認証コンテキストの Domain Primitive 定義。"""

import re
from dataclasses import dataclass
from typing import Self

from app.domain.foundation.exceptions import DomainValidationError
from app.domain.foundation.primitives import MaskedPiiString, NonEmptyString

_CONTROL_CHAR_PATTERN = re.compile(r"[\x00-\x1f\x7f]")
_EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_SHA256_HEX_PATTERN = re.compile(r"^[0-9a-f]{64}$")
_ASCII_SYMBOL_CHARS = frozenset("!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~")

_MIN_PASSWORD_LENGTH = 13
_MAX_PASSWORD_LENGTH = 128
_MIN_PASSWORD_CHAR_CLASSES = 3


@dataclass(frozen=True, slots=True, repr=False)
class UserEmail(MaskedPiiString):
    """小文字正規化と形式検証を行うユーザーメールアドレス。"""

    def validate(self) -> None:
        super().validate()
        if _CONTROL_CHAR_PATTERN.search(self.value):
            raise DomainValidationError(
                "メールアドレスに制御文字を含めることはできません。",
                code="INVALID_USER_EMAIL",
            )
        if self.value != self.value.lower():
            raise DomainValidationError(
                "メールアドレスは小文字で正規化されている必要があります。",
                code="INVALID_USER_EMAIL",
            )
        if not (3 <= len(self.value) <= 254) or not _EMAIL_PATTERN.fullmatch(self.value):
            raise DomainValidationError(
                "メールアドレスの形式が正しくありません。",
                code="INVALID_USER_EMAIL",
            )

    @classmethod
    def parse(cls, raw: str) -> Self:
        """前後空白を除去し小文字正規化してメールアドレスを生成する。"""
        if not isinstance(raw, str):
            raise DomainValidationError(
                "メールアドレスは文字列である必要があります。",
                code="INVALID_USER_EMAIL",
            )
        return cls(raw.strip().lower())


@dataclass(frozen=True, slots=True)
class UserDisplayName(NonEmptyString):
    """ユーザー表示名（1〜100 文字・制御文字禁止）。"""

    def validate(self) -> None:
        super().validate()
        if _CONTROL_CHAR_PATTERN.search(self.value):
            raise DomainValidationError(
                "表示名に制御文字を含めることはできません。",
                code="INVALID_USER_DISPLAY_NAME",
            )
        if len(self.value) > 100:
            raise DomainValidationError(
                "表示名は 100 文字以内で入力してください。",
                code="INVALID_USER_DISPLAY_NAME",
            )


@dataclass(frozen=True, slots=True, repr=False)
class PlainPassword(MaskedPiiString):
    """安全管理ガイドライン第7.0版（2FA未導入時）準拠の平文パスワード Primitive。"""

    def validate(self) -> None:
        super().validate()
        if _CONTROL_CHAR_PATTERN.search(self.value):
            raise DomainValidationError(
                "パスワードに制御文字を含めることはできません。",
                code="INVALID_PASSWORD_POLICY",
            )
        if not (_MIN_PASSWORD_LENGTH <= len(self.value) <= _MAX_PASSWORD_LENGTH):
            raise DomainValidationError(
                "パスワードは 13 文字以上 128 文字以下で入力してください。",
                code="INVALID_PASSWORD_POLICY",
            )
        has_upper = any("A" <= ch <= "Z" for ch in self.value)
        has_lower = any("a" <= ch <= "z" for ch in self.value)
        has_digit = any("0" <= ch <= "9" for ch in self.value)
        has_symbol = any(ch in _ASCII_SYMBOL_CHARS for ch in self.value)
        if sum((has_upper, has_lower, has_digit, has_symbol)) < _MIN_PASSWORD_CHAR_CLASSES:
            raise DomainValidationError(
                "パスワードは英大文字・英小文字・数字・記号のうち 3 種類以上を含めてください。",
                code="INVALID_PASSWORD_POLICY",
            )

    @classmethod
    def parse(cls, raw: str) -> Self:
        """入力文字列を暗黙トリムせずそのまま検証して生成する。"""
        if not isinstance(raw, str):
            raise DomainValidationError(
                "パスワードは文字列である必要があります。",
                code="INVALID_PASSWORD_POLICY",
            )
        return cls(raw)


@dataclass(frozen=True, slots=True, repr=False)
class PasswordHash(MaskedPiiString):
    """永続化用のハッシュ化済みパスワード。"""


@dataclass(frozen=True, slots=True, repr=False)
class TokenHash(MaskedPiiString):
    """SHA-256 hex 形式のトークンハッシュ。"""

    def validate(self) -> None:
        super().validate()
        if not _SHA256_HEX_PATTERN.fullmatch(self.value):
            raise DomainValidationError(
                "トークンハッシュの形式が不正です。",
                code="INVALID_TOKEN_HASH",
            )
