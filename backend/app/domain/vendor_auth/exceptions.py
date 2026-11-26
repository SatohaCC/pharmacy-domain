"""システムベンダー認証コンテキストのドメイン例外定義。"""

from typing import ClassVar

from app.domain.foundation.exceptions import (
    DomainAuthenticationError,
    DomainAuthorizationError,
    DomainConflictError,
    DomainNotFoundError,
)


class DuplicateVendorEmailError(DomainConflictError):
    """同一メールアドレスのベンダーユーザーが既に存在する場合の例外。"""

    default_code: ClassVar[str] = "DUPLICATE_VENDOR_EMAIL"


class BootstrapAdminAlreadyExistsError(DomainConflictError):
    """既にベンダーユーザーが存在するため初期管理者を発行できない場合の例外。"""

    default_code: ClassVar[str] = "BOOTSTRAP_ADMIN_ALREADY_EXISTS"


class VendorUserNotFoundError(DomainNotFoundError):
    """対象のベンダーユーザーが見つからない場合の例外。"""

    default_code: ClassVar[str] = "VENDOR_USER_NOT_FOUND"


class VendorAdminRequiredError(DomainAuthorizationError):
    """ベンダー管理者ロールが必要な操作を一般社員等が試みた場合の例外。"""

    default_code: ClassVar[str] = "VENDOR_ADMIN_REQUIRED"


class VendorCredentialsInvalidError(DomainAuthenticationError):
    """ログイン資格情報不一致またはアカウント無効時の例外。"""

    default_code: ClassVar[str] = "INVALID_CREDENTIALS"


class VendorSessionInvalidError(DomainAuthenticationError):
    """リフレッシュセッションが無効・失効済み・期限切れの場合の例外。"""

    default_code: ClassVar[str] = "REFRESH_TOKEN_INVALID"
