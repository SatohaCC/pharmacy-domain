"""ドメイン層の基底例外定義。"""

import re
from collections.abc import Mapping
from types import MappingProxyType

type ErrorDetailScalar = str | int | float | bool | None
type ErrorDetails = Mapping[str, ErrorDetailScalar]

_ERROR_CODE_PATTERN = re.compile(r"^[A-Z][A-Z0-9_]*$")
_DETAIL_KEY_PATTERN = re.compile(r"^[a-z][a-z0-9_]*$")
_CONTROL_CHAR_PATTERN = re.compile(r"[\x00-\x1f\x7f]")


def validate_error_details(details: ErrorDetails | None) -> ErrorDetails:
    """安全なスカラー値とキーのみを許可し、不変マッピングを返す。"""
    if not details:
        return MappingProxyType({})
    normalized: dict[str, ErrorDetailScalar] = {}
    for key, value in details.items():
        if not isinstance(key, str) or not _DETAIL_KEY_PATTERN.fullmatch(key):
            raise ValueError("details のキー形式が不正です。")
        if value is not None and not isinstance(value, bool | int | float | str):
            raise TypeError("details の値にはプリミティブ型のみ指定できます。")
        if isinstance(value, str) and _CONTROL_CHAR_PATTERN.search(value):
            raise ValueError("details の文字列値に制御文字は含められません。")
        normalized[key] = value
    return MappingProxyType(normalized)


class DomainError(Exception):
    """ドメインルール違反の基底例外（UI都合やPIIを含めない）。"""

    def __init__(
        self,
        message: str,
        *,
        code: str = "DOMAIN_ERROR",
        reason: str | None = None,
        action_hint: str | None = None,
        details: ErrorDetails | None = None,
    ) -> None:
        if not message or not message.strip():
            raise ValueError("例外メッセージは空にできません。")
        if not _ERROR_CODE_PATTERN.fullmatch(code):
            raise ValueError("不正なエラーコード形式です。")
        if reason is not None and not reason.strip():
            raise ValueError("reason は空にできません。")
        if action_hint is not None and not action_hint.strip():
            raise ValueError("action_hint は空にできません。")

        super().__init__(message)
        self._code = code
        self._message = message
        self._reason = reason if reason is not None else message
        self._action_hint = action_hint
        self._details = validate_error_details(details)

    @property
    def code(self) -> str:
        return self._code

    @property
    def message(self) -> str:
        return self._message

    @property
    def reason(self) -> str:
        return self._reason

    @property
    def action_hint(self) -> str | None:
        return self._action_hint

    @property
    def details(self) -> ErrorDetails:
        """安全な構造化メタデータ（PIIや生の秘密値は含めないこと）。"""
        return self._details


class DomainValidationError(DomainError):
    """値や不変条件の検証失敗を表すドメイン例外。"""

    def __init__(
        self,
        message: str,
        *,
        code: str = "VALIDATION_ERROR",
        reason: str | None = None,
        action_hint: str | None = None,
        details: ErrorDetails | None = None,
    ) -> None:
        super().__init__(
            message,
            code=code,
            reason=reason,
            action_hint=action_hint,
            details=details,
        )


class DomainNotFoundError(DomainError):
    """対象エンティティが存在しないことを表すドメイン例外。"""

    def __init__(
        self,
        message: str,
        *,
        code: str = "NOT_FOUND",
        reason: str | None = None,
        action_hint: str | None = None,
        details: ErrorDetails | None = None,
    ) -> None:
        super().__init__(
            message,
            code=code,
            reason=reason,
            action_hint=action_hint,
            details=details,
        )


class DomainConflictError(DomainError):
    """状態競合や一意性制約違反を表すドメイン例外。"""

    def __init__(
        self,
        message: str,
        *,
        code: str = "CONFLICT",
        reason: str | None = None,
        action_hint: str | None = None,
        details: ErrorDetails | None = None,
    ) -> None:
        super().__init__(
            message,
            code=code,
            reason=reason,
            action_hint=action_hint,
            details=details,
        )


class DomainAuthorizationError(DomainError):
    """ロール・資格・テナント境界などドメイン上の認可違反を表す例外。"""

    def __init__(
        self,
        message: str,
        *,
        code: str = "FORBIDDEN",
        reason: str | None = None,
        action_hint: str | None = None,
        details: ErrorDetails | None = None,
        conceal_as_not_found: bool = False,
    ) -> None:
        super().__init__(
            message,
            code=code,
            reason=reason,
            action_hint=action_hint,
            details=details,
        )
        self._conceal_as_not_found = conceal_as_not_found

    @property
    def conceal_as_not_found(self) -> bool:
        """IDOR 対策として外部境界で 404 へ秘匿マッピングするかを返す。"""
        return self._conceal_as_not_found
