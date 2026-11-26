"""ドメイン層の基底例外定義。"""

from collections.abc import Mapping
from types import MappingProxyType
from typing import ClassVar

type ErrorDetailScalar = str | int | float | bool | None
type ErrorDetails = Mapping[str, ErrorDetailScalar]


class DomainError(Exception):
    """ドメインルール違反の基底例外（PIIや秘密値は含めない）。"""

    default_code: ClassVar[str] = "DOMAIN_ERROR"

    def __init__(
        self,
        message: str,
        *,
        code: str | None = None,
        details: ErrorDetails | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.code = code or self.default_code
        self.details: ErrorDetails = (
            MappingProxyType(dict(details)) if details else MappingProxyType({})
        )


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

    def __init__(
        self,
        message: str,
        *,
        code: str | None = None,
        details: ErrorDetails | None = None,
        conceal_as_not_found: bool = False,
    ) -> None:
        super().__init__(message, code=code, details=details)
        self.conceal_as_not_found = conceal_as_not_found


class DomainAuthenticationError(DomainError):
    """資格情報の不一致やトークン失効など認証失敗を表すドメイン例外。"""

    default_code: ClassVar[str] = "UNAUTHORIZED"
