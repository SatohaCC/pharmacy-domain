"""共通認証コンテキストのドメイン例外定義。"""

from typing import ClassVar

from app.domain.foundation.exceptions import (
    DomainAuthenticationError,
    DomainAuthorizationError,
    DomainConflictError,
    DomainNotFoundError,
    DomainValidationError,
)


class DuplicateUserEmailError(DomainConflictError):
    """同一所属スコープ内でメールアドレスが重複している場合の例外。"""

    default_code: ClassVar[str] = "DUPLICATE_USER_EMAIL"


class BootstrapAdminAlreadyExistsError(DomainConflictError):
    """既にベンダーユーザーが存在するため初期管理者を発行できない場合の例外。"""

    default_code: ClassVar[str] = "BOOTSTRAP_ADMIN_ALREADY_EXISTS"


class AuthUserNotFoundError(DomainNotFoundError):
    """対象の認証ユーザーが見つからない場合の例外。"""

    default_code: ClassVar[str] = "AUTH_USER_NOT_FOUND"


class InsufficientRoleError(DomainAuthorizationError):
    """必要なスコープ付きロールを持たない場合の認可例外。"""

    default_code: ClassVar[str] = "INSUFFICIENT_ROLE"


class ScopeViolationError(DomainValidationError):
    """ロールの許容スコープや 1 ユーザー 1 所属制約に違反した場合の例外。"""

    default_code: ClassVar[str] = "INVALID_ROLE_SCOPE"


class InvalidCredentialsError(DomainAuthenticationError):
    """資格情報の不一致またはアカウント無効時の例外。"""

    default_code: ClassVar[str] = "INVALID_CREDENTIALS"


class RefreshSessionInvalidError(DomainAuthenticationError):
    """リフレッシュセッションが無効・失効済み・期限切れの場合の例外。"""

    default_code: ClassVar[str] = "REFRESH_TOKEN_INVALID"
