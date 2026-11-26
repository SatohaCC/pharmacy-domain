"""共通認証コンテキストのエンティティと不変条件（1 ユーザー 1 所属 + スコープ付きロール）。"""

from dataclasses import dataclass
from datetime import timedelta

from app.domain.auth.exceptions import (
    InvalidCredentialsError,
    ScopeViolationError,
)
from app.domain.auth.identifiers import (
    RefreshSessionId,
    RefreshTokenFamilyId,
    RoleAssignmentId,
    TenantId,
    UserId,
)
from app.domain.auth.primitives import (
    PasswordHash,
    TokenHash,
    UserDisplayName,
    UserEmail,
)
from app.domain.auth.value_objects import (
    AuthScope,
    RoleName,
    UserStatus,
)
from app.domain.foundation.exceptions import DomainValidationError
from app.domain.foundation.primitives import AwareDatetime

ACCESS_TOKEN_TTL_MINUTES = 30
REFRESH_TOKEN_TTL_MINUTES = 480


@dataclass(slots=True)
class User:
    """認証主体（1 ユーザー 1 所属スコープ）。"""

    id: UserId
    email: UserEmail
    display_name: UserDisplayName
    affiliation: AuthScope
    status: UserStatus
    password_hash: PasswordHash
    created_at: AwareDatetime
    updated_at: AwareDatetime
    created_by: UserId | None = None

    def __setattr__(self, name: str, value: object) -> None:
        if name == "affiliation" and hasattr(self, name):
            raise AttributeError("ユーザーの所属は作成後に変更できません。")
        object.__setattr__(self, name, value)

    def __delattr__(self, name: str) -> None:
        if name == "affiliation":
            raise AttributeError("ユーザーの所属は削除できません。")
        object.__delattr__(self, name)

    @classmethod
    def create_bootstrap_vendor_admin(
        cls,
        *,
        user_id: UserId,
        email: UserEmail,
        display_name: UserDisplayName,
        password_hash: PasswordHash,
        now: AwareDatetime,
    ) -> User:
        """コンソールから最初のシステムベンダー管理ユーザーを作成する。"""
        return cls(
            id=user_id,
            email=email,
            display_name=display_name,
            affiliation=AuthScope.vendor(),
            status=UserStatus.ACTIVE,
            password_hash=password_hash,
            created_at=now,
            updated_at=now,
            created_by=None,
        )

    @classmethod
    def create_vendor_user(
        cls,
        *,
        actor_id: UserId,
        user_id: UserId,
        email: UserEmail,
        display_name: UserDisplayName,
        password_hash: PasswordHash,
        now: AwareDatetime,
    ) -> User:
        """ベンダー管理者が新しいベンダー社員ユーザーを作成する。"""
        return cls(
            id=user_id,
            email=email,
            display_name=display_name,
            affiliation=AuthScope.vendor(),
            status=UserStatus.ACTIVE,
            password_hash=password_hash,
            created_at=now,
            updated_at=now,
            created_by=actor_id,
        )

    @classmethod
    def create_tenant_user(
        cls,
        *,
        actor_id: UserId | None,
        user_id: UserId,
        tenant_id: TenantId,
        email: UserEmail,
        display_name: UserDisplayName,
        password_hash: PasswordHash,
        now: AwareDatetime,
    ) -> User:
        """指定された薬局テナントに所属するユーザーを作成する（1 ユーザー 1 所属）。"""
        return cls(
            id=user_id,
            email=email,
            display_name=display_name,
            affiliation=AuthScope.tenant(tenant_id),
            status=UserStatus.ACTIVE,
            password_hash=password_hash,
            created_at=now,
            updated_at=now,
            created_by=actor_id,
        )

    def ensure_can_authenticate(self) -> None:
        """アカウントが認証・トークン更新可能な有効状態であることを検証する。"""
        if self.status != UserStatus.ACTIVE:
            raise InvalidCredentialsError(
                "メールアドレスまたはパスワードが正しくありません。",
                code="INVALID_CREDENTIALS",
            )

    def disable(self, at: AwareDatetime) -> None:
        """アカウントを無効化する。"""
        self.status = UserStatus.DISABLED
        self.updated_at = at


@dataclass(slots=True)
class RoleAssignment:
    """ユーザーへのスコープ付きロール付与（半開区間 [valid_from, valid_to)）。"""

    id: RoleAssignmentId
    user_id: UserId
    role: RoleName
    scope: AuthScope
    valid_from: AwareDatetime
    valid_to: AwareDatetime | None
    granted_at: AwareDatetime
    revoked_at: AwareDatetime | None = None
    granted_by: UserId | None = None

    def __post_init__(self) -> None:
        if self.role.allowed_scope_type() != self.scope.scope_type:
            raise ScopeViolationError(
                f"ロール {self.role.value} は "
                f"{self.scope.scope_type.value} スコープへ付与できません。",
                code="INVALID_ROLE_SCOPE",
            )
        if self.valid_to is not None and self.valid_from.value >= self.valid_to.value:
            raise DomainValidationError(
                "ロール有効期間の開始日時は終了日時より前である必要があります。",
                code="INVALID_ROLE_VALIDITY_RANGE",
            )

    @classmethod
    def grant_to_user(
        cls,
        *,
        assignment_id: RoleAssignmentId,
        user: User,
        role: RoleName,
        scope: AuthScope,
        valid_from: AwareDatetime,
        valid_to: AwareDatetime | None = None,
        granted_at: AwareDatetime,
        granted_by: UserId | None = None,
    ) -> RoleAssignment:
        """1 ユーザー 1 所属の不変条件を検証したうえでロールを付与する。"""
        if user.affiliation != scope:
            raise ScopeViolationError(
                "ユーザーの所属スコープと異なるスコープのロールは付与できません。",
                code="INVALID_ROLE_SCOPE",
            )
        return cls(
            id=assignment_id,
            user_id=user.id,
            role=role,
            scope=scope,
            valid_from=valid_from,
            valid_to=valid_to,
            granted_at=granted_at,
            granted_by=granted_by,
        )

    def is_active_at(self, now: AwareDatetime) -> bool:
        """指定時点でこのロール付与が有効かどうかを返す（半開区間 [valid_from, valid_to)）。"""
        if self.revoked_at is not None:
            return False
        if now.value < self.valid_from.value:
            return False
        return self.valid_to is None or now.value < self.valid_to.value

    def revoke(self, now: AwareDatetime) -> None:
        """ロール付与を即時失効させる。"""
        if self.revoked_at is None:
            self.revoked_at = now


@dataclass(slots=True)
class RefreshSession:
    """リフレッシュトークン（480 分）のセッション状態とローテーション履歴。"""

    id: RefreshSessionId
    family_id: RefreshTokenFamilyId
    user_id: UserId
    scope: AuthScope
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
        user_id: UserId,
        scope: AuthScope,
        token_hash: TokenHash,
        issued_at: AwareDatetime,
    ) -> RefreshSession:
        """480 分の有効期限を持つ新しいリフレッシュセッションを発行する。"""
        expires_at = AwareDatetime(issued_at.value + timedelta(minutes=REFRESH_TOKEN_TTL_MINUTES))
        return cls(
            id=session_id,
            family_id=family_id,
            user_id=user_id,
            scope=scope,
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
