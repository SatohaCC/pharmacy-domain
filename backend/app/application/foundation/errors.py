"""アプリケーション層の公開例外契約。"""

from collections.abc import Mapping
from types import MappingProxyType
from typing import ClassVar, Literal

type ErrorDetailScalar = str | int | float | bool | None
type ErrorDetails = Mapping[str, ErrorDetailScalar]
type StateImpact = Literal["unchanged", "draft_preserved", "unknown"]


class ApplicationError(Exception):
    """ユースケース実行時の失敗を表す基底例外。"""

    default_code: ClassVar[str] = "APPLICATION_ERROR"

    def __init__(
        self,
        message: str,
        *,
        code: str | None = None,
        details: ErrorDetails | None = None,
        state_impact: StateImpact = "unchanged",
    ) -> None:
        super().__init__(message)
        self.message = message
        self.code = code or self.default_code
        self.details: ErrorDetails = (
            MappingProxyType(dict(details)) if details else MappingProxyType({})
        )
        self.state_impact: StateImpact = state_impact


class ApplicationBadRequestError(ApplicationError):
    """入力の組み合わせや更新指定が不正であることを表す例外。"""

    default_code: ClassVar[str] = "BAD_REQUEST"


class ApplicationValidationError(ApplicationError):
    """業務値や形式の検証失敗を表す例外。"""

    default_code: ClassVar[str] = "VALIDATION_ERROR"


class ApplicationAuthorizationError(ApplicationError):
    """資格・ロール・テナント境界など業務上の認可違反を表す例外。"""

    default_code: ClassVar[str] = "FORBIDDEN"

    def __init__(
        self,
        message: str,
        *,
        code: str | None = None,
        details: ErrorDetails | None = None,
        state_impact: StateImpact = "unchanged",
        conceal_as_not_found: bool = False,
    ) -> None:
        super().__init__(message, code=code, details=details, state_impact=state_impact)
        self.conceal_as_not_found = conceal_as_not_found


class ApplicationNotFoundError(ApplicationError):
    """対象リソースが存在しないことを表す例外。"""

    default_code: ClassVar[str] = "NOT_FOUND"


class ApplicationConflictError(ApplicationError):
    """競合や一意性制約違反を表す例外。"""

    default_code: ClassVar[str] = "CONFLICT"


class ApplicationAuthenticationError(ApplicationError):
    """認証失敗やトークン無効・期限切れを表す例外。"""

    default_code: ClassVar[str] = "UNAUTHORIZED"
