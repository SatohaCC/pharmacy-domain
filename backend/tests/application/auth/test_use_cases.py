"""共通認証アプリケーションユースケースの単体テスト（Fake ポート）。"""

from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from types import TracebackType

import pytest

from app.application.auth.commands import (
    AuthCommandService,
    AuthTokenVerifierService,
    VendorUserCommandService,
)
from app.application.auth.contracts import (
    AuthLoginInput,
    BootstrapVendorAdminInput,
    CreateVendorUserInput,
    LogoutAuthSessionInput,
    RefreshAuthSessionInput,
)
from app.application.auth.queries import AuthUserQueryService
from app.application.foundation.errors import (
    ApplicationAuthenticationError,
    ApplicationAuthorizationError,
    ApplicationConflictError,
)
from app.domain.auth.entities import RefreshSession, RoleAssignment, User
from app.domain.auth.exceptions import DuplicateUserEmailError
from app.domain.auth.identifiers import RefreshSessionId, RefreshTokenFamilyId, UserId
from app.domain.auth.primitives import UserEmail
from app.domain.auth.value_objects import AffiliationType, AuthScope
from app.domain.foundation.primitives import AwareDatetime
from app.infrastructure.security.jwt_codec import Hs256JwtTokenIssuer, Sha256TokenHasher
from app.infrastructure.security.password_hasher import ScryptPasswordHasher


class _FakeClock:
    def __init__(self, current: datetime) -> None:
        self.current = current

    def now(self) -> datetime:
        return self.current

    def advance(self, *, minutes: int) -> None:
        self.current += timedelta(minutes=minutes)


class _SequentialIdGenerator:
    def __init__(self) -> None:
        self._counter = 0

    def new_id(self) -> str:
        self._counter += 1
        return f"id-{self._counter}"


class _InMemoryUserRepo:
    def __init__(self, store: dict[str, User]) -> None:
        self._store = store

    def count_by_affiliation(self, affiliation_type: AffiliationType) -> int:
        return sum(1 for u in self._store.values() if u.affiliation.scope_type == affiliation_type)

    def get_by_id(self, user_id: UserId) -> User | None:
        return self._store.get(user_id.value)

    def get_by_email_in_scope(self, email: UserEmail, scope: AuthScope) -> User | None:
        for user in self._store.values():
            if user.affiliation == scope and user.email == email:
                return user
        return None

    def add(self, user: User) -> None:
        if self.get_by_email_in_scope(user.email, user.affiliation) is not None:
            raise DuplicateUserEmailError("重複", code="DUPLICATE_VENDOR_EMAIL")
        self._store[user.id.value] = user

    def save(self, user: User) -> None:
        self._store[user.id.value] = user


class _InMemoryRoleRepo:
    def __init__(self, store: dict[str, RoleAssignment]) -> None:
        self._store = store

    def list_active_for_user(self, user_id: UserId, now: AwareDatetime) -> Sequence[RoleAssignment]:
        return tuple(
            item
            for item in self._store.values()
            if item.user_id == user_id and item.is_active_at(now)
        )

    def list_active_for_users(
        self, user_ids: Sequence[UserId], now: AwareDatetime
    ) -> Sequence[RoleAssignment]:
        id_set = set(user_ids)
        return tuple(
            item
            for item in self._store.values()
            if item.user_id in id_set and item.is_active_at(now)
        )

    def add(self, assignment: RoleAssignment) -> None:
        self._store[assignment.id.value] = assignment

    def save(self, assignment: RoleAssignment) -> None:
        self._store[assignment.id.value] = assignment

    def revoke_all_for_user(self, user_id: UserId, now: AwareDatetime) -> None:
        for item in self._store.values():
            if item.user_id == user_id:
                item.revoke(now)


class _InMemorySessionRepo:
    def __init__(self, store: dict[str, RefreshSession]) -> None:
        self._store = store

    def get_by_id(self, session_id: RefreshSessionId) -> RefreshSession | None:
        return self._store.get(session_id.value)

    def add(self, session: RefreshSession) -> None:
        self._store[session.id.value] = session

    def save(self, session: RefreshSession) -> None:
        self._store[session.id.value] = session

    def revoke_family(self, family_id: RefreshTokenFamilyId, now: AwareDatetime) -> None:
        for session in self._store.values():
            if session.family_id == family_id:
                session.revoke(now)

    def revoke_all_for_user(self, user_id: UserId, now: AwareDatetime) -> None:
        for session in self._store.values():
            if session.user_id == user_id:
                session.revoke(now)


class _FakeUoW:
    def __init__(
        self,
        users: dict[str, User],
        roles: dict[str, RoleAssignment],
        sessions: dict[str, RefreshSession],
    ) -> None:
        self.users = _InMemoryUserRepo(users)
        self.role_assignments = _InMemoryRoleRepo(roles)
        self.refresh_sessions = _InMemorySessionRepo(sessions)

    def __enter__(self) -> _FakeUoW:
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: TracebackType | None,
    ) -> None:
        return None

    def commit(self) -> None:
        return None

    def rollback(self) -> None:
        return None


class _FakeReadGateway:
    def __init__(self, users: dict[str, User], roles: dict[str, RoleAssignment]) -> None:
        self._users = users
        self._roles = roles

    def get_by_id(self, user_id: str) -> User | None:
        return self._users.get(user_id)

    def list_active_roles_for_user(self, user_id: str, now: datetime) -> Sequence[RoleAssignment]:
        now_vo = AwareDatetime(now)
        return tuple(
            r for r in self._roles.values() if r.user_id.value == user_id and r.is_active_at(now_vo)
        )

    def list_by_affiliation(
        self, affiliation_type: AffiliationType, *, tenant_id: str | None = None
    ) -> Sequence[User]:
        return tuple(
            u
            for u in self._users.values()
            if u.affiliation.scope_type == affiliation_type
            and (
                tenant_id is None
                or (u.affiliation.tenant_id and u.affiliation.tenant_id.value == tenant_id)
            )
        )

    def list_active_roles_for_users(
        self, user_ids: Sequence[str], now: datetime
    ) -> Sequence[RoleAssignment]:
        now_vo = AwareDatetime(now)
        id_set = set(user_ids)
        return tuple(
            r for r in self._roles.values() if r.user_id.value in id_set and r.is_active_at(now_vo)
        )


def _setup_services():
    users: dict[str, User] = {}
    roles: dict[str, RoleAssignment] = {}
    sessions: dict[str, RefreshSession] = {}
    clock = _FakeClock(datetime(2026, 11, 26, 9, 0, tzinfo=UTC))
    id_gen = _SequentialIdGenerator()
    pw_hasher = ScryptPasswordHasher()
    token_hasher = Sha256TokenHasher()
    jwt_issuer = Hs256JwtTokenIssuer(
        secret_key="test-secret-key-at-least-32-characters-long",
        issuer="pharmacy-domain",
    )

    def uow_factory() -> _FakeUoW:
        return _FakeUoW(users, roles, sessions)

    read_gateway = _FakeReadGateway(users, roles)

    auth_cmd = AuthCommandService(
        uow_factory=uow_factory,
        clock=clock,
        id_generator=id_gen,
        password_hasher=pw_hasher,
        token_hasher=token_hasher,
        jwt_issuer=jwt_issuer,
    )
    vendor_cmd = VendorUserCommandService(
        uow_factory=uow_factory,
        clock=clock,
        id_generator=id_gen,
        password_hasher=pw_hasher,
    )
    user_qry = AuthUserQueryService(read_gateway=read_gateway, clock=clock)
    verifier = AuthTokenVerifierService(
        jwt_issuer=jwt_issuer,
        read_gateway=read_gateway,
        clock=clock,
    )
    return clock, auth_cmd, vendor_cmd, user_qry, verifier, roles


def test_unified_auth_bootstrap_login_refresh_role_check_and_revocation() -> None:
    clock, auth_cmd, vendor_cmd, user_qry, verifier, roles = _setup_services()

    admin = auth_cmd.bootstrap_initial_vendor_admin(
        BootstrapVendorAdminInput(
            email="Admin@Example.COM",
            display_name="初期管理者",
            password="AdminPassword123!",
        )
    )
    assert admin.email == "admin@example.com"
    assert admin.affiliation_type == "vendor"
    assert admin.roles == ("vendor_admin",)

    with pytest.raises(ApplicationConflictError) as dup_boot:
        auth_cmd.bootstrap_initial_vendor_admin(
            BootstrapVendorAdminInput(
                email="admin2@example.com",
                display_name="2人目",
                password="AdminPassword123!",
            )
        )
    assert dup_boot.value.code == "BOOTSTRAP_ADMIN_ALREADY_EXISTS"

    session1 = auth_cmd.login(
        AuthLoginInput(email="admin@example.com", password="AdminPassword123!")
    )
    assert session1.access_token_expires_in_seconds == 1800
    assert session1.refresh_token_expires_in_seconds == 28800

    principal = verifier.verify_access_token(session1.access_token)
    assert principal.roles == ("vendor_admin",)

    # 30分経過後は期限切れ、480分以内ならリフレッシュ可。
    clock.advance(minutes=30)
    with pytest.raises(ApplicationAuthenticationError) as expired:
        verifier.verify_access_token(session1.access_token)
    assert expired.value.code == "AUTH_TOKEN_EXPIRED"

    session2 = auth_cmd.refresh(RefreshAuthSessionInput(refresh_token=session1.refresh_token))
    # 再利用検知でファミリー全失効。
    with pytest.raises(ApplicationAuthenticationError) as reuse:
        auth_cmd.refresh(RefreshAuthSessionInput(refresh_token=session1.refresh_token))
    assert reuse.value.code == "REFRESH_TOKEN_REVOKED"
    with pytest.raises(ApplicationAuthenticationError):
        auth_cmd.refresh(RefreshAuthSessionInput(refresh_token=session2.refresh_token))

    # 社員発行・権限チェック・ロール剥奪の即時反映。
    session3 = auth_cmd.login(
        AuthLoginInput(email="admin@example.com", password="AdminPassword123!")
    )
    member = vendor_cmd.create_vendor_user(
        admin.id,
        CreateVendorUserInput(
            email="member@example.com",
            display_name="運用社員",
            roles=("vendor_member",),
            password="MemberPassword123!",
        ),
    )
    assert member.roles == ("vendor_member",)
    assert user_qry.list_vendor_users(admin.id).total == 2

    with pytest.raises(ApplicationAuthorizationError) as forbidden:
        user_qry.list_vendor_users(member.id)
    assert forbidden.value.code == "VENDOR_ADMIN_REQUIRED"

    # ロールを剥奪すると、既存アクセストークン検証時にも即時ロールが落ちる。
    for assignment in roles.values():
        if assignment.user_id.value == admin.id:
            assignment.revoke(AwareDatetime(clock.now()))
    revoked_principal = verifier.verify_access_token(session3.access_token)
    assert revoked_principal.roles == ()

    auth_cmd.logout(LogoutAuthSessionInput(refresh_token=session3.refresh_token))
    with pytest.raises(ApplicationAuthenticationError):
        auth_cmd.refresh(RefreshAuthSessionInput(refresh_token=session3.refresh_token))
