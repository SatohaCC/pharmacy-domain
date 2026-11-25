"""ドメイン層の基底例外定義。"""

import math
import re
from collections.abc import Mapping
from types import MappingProxyType
from typing import ClassVar

type ErrorDetailScalar = str | int | float | bool | None
type ErrorDetails = Mapping[str, ErrorDetailScalar]

_ERROR_CODE_PATTERN = re.compile(r"^[A-Z][A-Z0-9_]*$")
_DETAIL_KEY_PATTERN = re.compile(r"^[a-z][a-z0-9_]*$")
_CONTROL_CHAR_PATTERN = re.compile(r"[\x00-\x1f\x7f]")
_DEFAULT_DOMAIN_MESSAGE = "ドメインルール違反が発生しました。"


def _resolve_code(code: str | None, default_code: str) -> str:
    if isinstance(code, str) and _ERROR_CODE_PATTERN.fullmatch(code):
        return code
    return default_code


def _resolve_message(message: str, default_message: str) -> str:
    if not isinstance(message, str):
        return default_message
    cleaned = _CONTROL_CHAR_PATTERN.sub("", message).strip()
    return cleaned if cleaned else default_message


def sanitize_error_details(details: ErrorDetails | None) -> ErrorDetails:
    """安全なスカラー値・キーのみを残し、制御文字を除去した不変マッピングを返す。"""
    if not details:
        return MappingProxyType({})
    normalized: dict[str, ErrorDetailScalar] = {}
    for key, value in details.items():
        if not isinstance(key, str) or not _DETAIL_KEY_PATTERN.fullmatch(key):
            continue
        if value is None or isinstance(value, bool | int):
            normalized[key] = value
        elif isinstance(value, float):
            if math.isfinite(value):
                normalized[key] = value
        elif isinstance(value, str):
            normalized[key] = _CONTROL_CHAR_PATTERN.sub("", value)
    return MappingProxyType(normalized)


class DomainError(Exception):
    """ドメインルール違反の基底例外（UI都合やPIIを含めない）。"""

    default_code: ClassVar[str] = "DOMAIN_ERROR"

    def __init__(
        self,
        message: str,
        *,
        code: str | None = None,
        details: ErrorDetails | None = None,
    ) -> None:
        resolved_message = _resolve_message(message, _DEFAULT_DOMAIN_MESSAGE)
        super().__init__(resolved_message)
        self._code = _resolve_code(code, self.default_code)
        self._message = resolved_message
        self._details = sanitize_error_details(details)

    @property
    def code(self) -> str:
        return self._code

    @property
    def message(self) -> str:
        return self._message

    @property
    def details(self) -> ErrorDetails:
        """安全な構造化メタデータ（PIIや生の秘密値は含めないこと）。"""
        return self._details


class DomainValidationError(DomainError):
    """値や不変条件の検証失敗を表すドメイン例外。"""

    default_code: ClassVar[str] = "VALIDATION_ERROR"


class DomainNotFoundError(DomainError):
    """対象エンティティが存在しないことを表すドメイン例外。"""

    default_code: ClassVar[str] = "NOT_FOUND"


class DomainConflictError(DomainError):
    """状態競合や一意性制約違反を表すドメイン例外。"""

    default_code: ClassVar[str] = "CONFLICT"


class DomainAuthorizationError(DomainError):
    """ロール・資格・テナント境界などドメイン上の認可違反を表す例外。"""

    default_code: ClassVar[str] = "FORBIDDEN"
