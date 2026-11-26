"""共通認証・スコープ付きロールの公開入出力契約および Inbound Port 定義。"""

from dataclasses import dataclass
from datetime import datetime
from typing import Literal, Protocol

type AffiliationTypeLiteral = Literal["vendor", "tenant"]
type RoleNameLiteral = Literal[
    "vendor_admin",
    "vendor_member",
    "tenant_admin",
    "pharmacist",
    "clerk",
]
type VendorRoleNameLiteral = Literal["vendor_admin", "vendor_member"]
type UserStatusLiteral = Literal["active", "disabled"]


@dataclass(frozen=True, slots=True)
class AuthUserView:
    """外部公開用の共通認証ユーザー表現。"""

    id: str
    email: str
    display_name: str
    affiliation_type: AffiliationTypeLiteral
    tenant_id: str | None
    roles: tuple[RoleNameLiteral, ...]
    status: UserStatusLiteral
    created_at: datetime
    updated_at: datetime


@dataclass(frozen=True, slots=True)
class AuthPrincipal:
    """アクセストークン検証済みの認証主体情報。"""

    user_id: str
    email: str
    display_name: str
    scope_type: AffiliationTypeLiteral
    tenant_id: str | None
    roles: tuple[RoleNameLiteral, ...]


@dataclass(frozen=True, slots=True, repr=False)
class AuthSessionView:
    """ログイン・リフレッシュ成功時の認証セッション結果。"""

    user: AuthUserView
    access_token: str
    refresh_token: str
    access_token_expires_in_seconds: int
    refresh_token_expires_in_seconds: int


@dataclass(frozen=True, slots=True, repr=False)
class BootstrapVendorAdminInput:
    """初期ベンダー管理者アカウント発行コマンド入力。"""

    email: str
    display_name: str
    password: str


@dataclass(frozen=True, slots=True, repr=False)
class AuthLoginInput:
    """共通ログインコマンド入力。"""

    email: str
    password: str
    scope_type: AffiliationTypeLiteral = "vendor"
    tenant_id: str | None = None


@dataclass(frozen=True, slots=True, repr=False)
class RefreshAuthSessionInput:
    """リフレッシュトークン更新コマンド入力。"""

    refresh_token: str


@dataclass(frozen=True, slots=True, repr=False)
class LogoutAuthSessionInput:
    """ログアウトコマンド入力。"""

    refresh_token: str | None


@dataclass(frozen=True, slots=True, repr=False)
class CreateVendorUserInput:
    """ベンダー管理者によるベンダー社員アカウント発行コマンド入力。"""

    email: str
    display_name: str
    roles: tuple[VendorRoleNameLiteral, ...]
    password: str


@dataclass(frozen=True, slots=True)
class AuthUserListResult:
    """認証ユーザー一覧取得結果。"""

    items: tuple[AuthUserView, ...]
    total: int


class AuthCommandPort(Protocol):
    """共通認証・初期管理者発行ユースケースの Inbound Port。"""

    def bootstrap_initial_vendor_admin(self, input_data: BootstrapVendorAdminInput) -> AuthUserView:
        """最初のシステムベンダー管理アカウントを発行する。"""
        ...

    def login(self, input_data: AuthLoginInput) -> AuthSessionView:
        """メールアドレスとパスワードで認証し JWT セッションを発行する。"""
        ...

    def refresh(self, input_data: RefreshAuthSessionInput) -> AuthSessionView:
        """リフレッシュトークンを検証・ローテーションして新セッションを発行する。"""
        ...

    def logout(self, input_data: LogoutAuthSessionInput) -> None:
        """リフレッシュセッションファミリーを即時失効させる。"""
        ...


class VendorUserCommandPort(Protocol):
    """ベンダー社員アカウント管理の更新系 Inbound Port。"""

    def create_vendor_user(self, actor_id: str, input_data: CreateVendorUserInput) -> AuthUserView:
        """ベンダー管理者権限で新しいベンダー社員アカウントを発行する。"""
        ...


class AuthUserQueryPort(Protocol):
    """共通認証ユーザー参照系 Inbound Port。"""

    def get_current_user(self, user_id: str) -> AuthUserView:
        """認証済み自身のユーザー情報を取得する。"""
        ...

    def list_vendor_users(self, actor_id: str) -> AuthUserListResult:
        """ベンダー管理者権限でベンダー所属ユーザー一覧を取得する。"""
        ...


class AuthTokenVerifierPort(Protocol):
    """アクセストークン検証用 Inbound Port。"""

    def verify_access_token(self, raw_token: str) -> AuthPrincipal:
        """アクセストークンを検証し最新の有効ユーザー主体と有効ロールを返す。"""
        ...
