"""システムベンダー認証コンテキストのエンティティと不変条件。"""

from dataclasses import dataclass
from datetime import timedelta

from app.domain.foundation.primitives import AwareDatetime
from app.domain.vendor_auth.exceptions import (
    VendorAdminRequiredError,
    VendorCredentialsInvalidError,
)
from app.domain.vendor_auth.identifiers import (
    RefreshSessionId,
    RefreshTokenFamilyId,
    VendorUserId,
)
from app.domain.vendor_auth.primitives import (
    PasswordHash,
    TokenHash,
    VendorDisplayName,
    VendorEmail,
)
from app.domain.vendor_auth.value_objects import VendorRole, VendorUserStatus

ACCESS_TOKEN_TTL_MINUTES = 30
REFRESH_TOKEN_TTL_MINUTES = 480


@dataclass(slots=True)
class VendorUser:
    """システムベンダー側の認証・運用ユーザー集約ルート。"""

    id: VendorUserId
    email: VendorEmail
    display_name: VendorDisplayName
    role: VendorRole
    status: VendorUserStatus
    password_hash: PasswordHash
    created_at: AwareDatetime
    updated_at: AwareDatetime
    created_by: VendorUserId | None = None

    @classmethod
    def create_bootstrap_admin(
        cls,
        *,
        user_id: VendorUserId,
        email: VendorEmail,
        display_name: VendorDisplayName,
        password_hash: PasswordHash,
        now: AwareDatetime,
    ) -> VendorUser:
        """コンソールから最初のシステムベンダー管理アカウントを発行する。"""
        return cls(
            id=user_id,
            email=email,
            display_name=display_name,
            role=VendorRole.ADMIN,
            status=VendorUserStatus.ACTIVE,
            password_hash=password_hash,
            created_at=now,
            updated_at=now,
            created_by=None,
        )

    @classmethod
    def create_by_admin(
        cls,
        *,
        actor: VendorUser,
        user_id: VendorUserId,
        email: VendorEmail,
        display_name: VendorDisplayName,
        role: VendorRole,
        password_hash: PasswordHash,
        now: AwareDatetime,
    ) -> VendorUser:
        """ログイン済みのベンダー管理者が新しい社員アカウントを発行する。"""
        actor.ensure_can_manage_vendor_users()
        return cls(
            id=user_id,
            email=email,
            display_name=display_name,
            role=role,
            status=VendorUserStatus.ACTIVE,
            password_hash=password_hash,
            created_at=now,
            updated_at=now,
            created_by=actor.id,
        )

    def ensure_can_authenticate(self) -> None:
        """アカウントが認証・トークン更新可能な有効状態であることを検証する。"""
        if self.status != VendorUserStatus.ACTIVE:
            raise VendorCredentialsInvalidError(
                "メールアドレスまたはパスワードが正しくありません。",
                code="INVALID_CREDENTIALS",
            )

    def ensure_can_manage_vendor_users(self) -> None:
        """ベンダーユーザー管理操作を実行できる管理者であることを検証する。"""
        if self.status != VendorUserStatus.ACTIVE or self.role != VendorRole.ADMIN:
            raise VendorAdminRequiredError(
                "この操作にはシステムベンダー管理者権限が必要です。",
                code="VENDOR_ADMIN_REQUIRED",
            )

    def disable(self, at: AwareDatetime) -> None:
        """アカウントを無効化する。"""
        self.status = VendorUserStatus.DISABLED
        self.updated_at = at


@dataclass(slots=True)
class RefreshSession:
    """リフレッシュトークン（480分）のセッション状態とローテーション履歴。"""

    id: RefreshSessionId
    family_id: RefreshTokenFamilyId
    vendor_user_id: VendorUserId
    token_hash: TokenHash
    issued_at: AwareDatetime
    expires_at: AwareDatetime
    rotated_at: AwareDatetime | None = None
    revoked_at: AwareDatetime | None = None
    replaced_by_session_id: RefreshSessionId | None = None

    @classmethod
    def issue(
        cls,
        *,
        session_id: RefreshSessionId,
        family_id: RefreshTokenFamilyId,
        vendor_user_id: VendorUserId,
        token_hash: TokenHash,
        issued_at: AwareDatetime,
    ) -> RefreshSession:
        """480 分の有効期限を持つ新しいリフレッシュセッションを発行する。"""
        expires_at = AwareDatetime(issued_at.value + timedelta(minutes=REFRESH_TOKEN_TTL_MINUTES))
        return cls(
            id=session_id,
            family_id=family_id,
            vendor_user_id=vendor_user_id,
            token_hash=token_hash,
            issued_at=issued_at,
            expires_at=expires_at,
        )

    def is_expired(self, now: AwareDatetime) -> bool:
        """現在時刻で有効期限切れかどうかを返す。"""
        return now.value >= self.expires_at.value

    def is_reused(self) -> bool:
        """すでに別セッションへローテーション済みかどうかを返す。"""
        return self.rotated_at is not None

    def is_revoked(self) -> bool:
        """明示的に失効済みかどうかを返す。"""
        return self.revoked_at is not None

    def is_active(self, now: AwareDatetime) -> bool:
        """現在有効なリフレッシュセッションかどうかを返す。"""
        return not self.is_reused() and not self.is_revoked() and not self.is_expired(now)

    def rotate(self, *, replaced_by_session_id: RefreshSessionId, now: AwareDatetime) -> None:
        """新しいセッションへローテーション済みの印を付ける。"""
        self.rotated_at = now
        self.replaced_by_session_id = replaced_by_session_id

    def revoke(self, now: AwareDatetime) -> None:
        """セッションを即時失効させる。"""
        if self.revoked_at is None:
            self.revoked_at = now
