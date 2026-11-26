"""システムベンダー認証の公開入出力契約および Inbound Port 定義。"""

from dataclasses import dataclass
from datetime import datetime
from typing import Literal, Protocol

type VendorRoleLiteral = Literal["admin", "member"]
type VendorUserStatusLiteral = Literal["active", "disabled"]


@dataclass(frozen=True, slots=True)
class VendorUserView:
    """外部公開用のベンダーユーザー表現。"""

    id: str
    email: str
    display_name: str
    role: VendorRoleLiteral
    status: VendorUserStatusLiteral
    created_at: datetime
    updated_at: datetime


@dataclass(frozen=True, slots=True)
class VendorAuthPrincipal:
    """アクセストークン検証済みの認証主体情報。"""

    user_id: str
    email: str
    display_name: str
    role: VendorRoleLiteral


@dataclass(frozen=True, slots=True, repr=False)
class VendorAuthSessionView:
    """ログイン・リフレッシュ成功時の認証セッション結果。"""

    user: VendorUserView
    access_token: str
    refresh_token: str
    access_token_expires_in_seconds: int
    refresh_token_expires_in_seconds: int


@dataclass(frozen=True, slots=True, repr=False)
class BootstrapVendorAdminInput:
    """初期管理者アカウント発行コマンド入力。"""

    email: str
    display_name: str
    password: str


@dataclass(frozen=True, slots=True, repr=False)
class VendorLoginInput:
    """ベンダーログインコマンド入力。"""

    email: str
    password: str


@dataclass(frozen=True, slots=True, repr=False)
class RefreshVendorSessionInput:
    """リフレッシュトークン更新コマンド入力。"""

    refresh_token: str


@dataclass(frozen=True, slots=True, repr=False)
class LogoutVendorSessionInput:
    """ログアウトコマンド入力。"""

    refresh_token: str | None


@dataclass(frozen=True, slots=True, repr=False)
class CreateVendorUserInput:
    """管理者によるベンダー社員アカウント発行コマンド入力。"""

    email: str
    display_name: str
    role: VendorRoleLiteral
    password: str


@dataclass(frozen=True, slots=True)
class VendorUserListResult:
    """ベンダーユーザー一覧取得結果。"""

    items: tuple[VendorUserView, ...]
    total: int


class VendorAuthCommandPort(Protocol):
    """認証・初期管理者発行ユースケースの Inbound Port。"""

    def bootstrap_initial_admin(self, input_data: BootstrapVendorAdminInput) -> VendorUserView:
        """最初のシステムベンダー管理アカウントを発行する。"""
        ...

    def login(self, input_data: VendorLoginInput) -> VendorAuthSessionView:
        """メールアドレスとパスワードで認証し JWT セッションを発行する。"""
        ...

    def refresh(self, input_data: RefreshVendorSessionInput) -> VendorAuthSessionView:
        """リフレッシュトークンを検証・ローテーションして新セッションを発行する。"""
        ...

    def logout(self, input_data: LogoutVendorSessionInput) -> None:
        """リフレッシュセッションファミリーを即時失効させる。"""
        ...


class VendorUserCommandPort(Protocol):
    """ベンダー社員アカウント管理の更新系 Inbound Port。"""

    def create_vendor_user(
        self, actor_id: str, input_data: CreateVendorUserInput
    ) -> VendorUserView:
        """管理者権限で新しいベンダー社員アカウントを発行する。"""
        ...


class VendorUserQueryPort(Protocol):
    """ベンダーユーザー参照系 Inbound Port。"""

    def get_current_user(self, user_id: str) -> VendorUserView:
        """認証済み自身のユーザー情報を取得する。"""
        ...

    def list_vendor_users(self, actor_id: str) -> VendorUserListResult:
        """管理者権限でベンダーユーザー一覧を取得する。"""
        ...


class VendorTokenVerifierPort(Protocol):
    """アクセストークン検証用 Inbound Port。"""

    def verify_access_token(self, raw_token: str) -> VendorAuthPrincipal:
        """アクセストークンを検証し最新の有効ユーザー主体を返す。"""
        ...
