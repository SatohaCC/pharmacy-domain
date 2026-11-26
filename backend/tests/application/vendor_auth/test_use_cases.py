"""VendorAuth アプリケーションユースケースの単体テスト（Fake ポート）。"""

from datetime import UTC, datetime, timedelta
from types import TracebackType

import pytest

from app.application.foundation.errors import (
    ApplicationAuthenticationError,
    ApplicationAuthorizationError,
    ApplicationConflictError,
)
from app.application.vendor_auth.commands import (
    VendorAuthCommandService,
    VendorTokenVerifierService,
    VendorUserCommandService,
)
from app.application.vendor_auth.contracts import (
    BootstrapVendorAdminInput,
    CreateVendorUserInput,
    LogoutVendorSessionInput,
    RefreshVendorSessionInput,
    VendorLoginInput,
)
from app.application.vendor_auth.queries import VendorUserQueryService
from app.domain.foundation.primitives import AwareDatetime
from app.domain.vendor_auth.entities import RefreshSession, VendorUser
from app.domain.vendor_auth.exceptions import DuplicateVendorEmailError
from app.domain.vendor_auth.identifiers import (
    RefreshSessionId,
    RefreshTokenFamilyId,
    VendorUserId,
)
from app.domain.vendor_auth.primitives import VendorEmail
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


class _InMemoryVendorUserRepo:
    def __init__(self, store: dict[str, VendorUser]) -> None:
        self._store = store

    def count_all(self) -> int:
        return len(self._store)

    def get_by_id(self, user_id: VendorUserId) -> VendorUser | None:
        return self._store.get(user_id.value)

    def get_by_email(self, email: VendorEmail) -> VendorUser | None:
        for user in self._store.values():
            if user.email == email:
                return user
        return None

    def add(self, user: VendorUser) -> None:
        if self.get_by_email(user.email) is not None:
            raise DuplicateVendorEmailError("重複", code="DUPLICATE_VENDOR_EMAIL")
        self._store[user.id.value] = user

    def save(self, user: VendorUser) -> None:
        self._store[user.id.value] = user


class _InMemoryRefreshSessionRepo:
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

    def revoke_all_for_user(self, vendor_user_id: VendorUserId, now: AwareDatetime) -> None:
        for session in self._store.values():
            if session.vendor_user_id == vendor_user_id:
                session.revoke(now)


class _FakeUoW:
    def __init__(
        self,
        users: dict[str, VendorUser],
        sessions: dict[str, RefreshSession],
    ) -> None:
        self.users = _InMemoryVendorUserRepo(users)
        self.refresh_sessions = _InMemoryRefreshSessionRepo(sessions)
        self.committed = False

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
        self.committed = True

    def rollback(self) -> None:
        return None


class _FakeReadGateway:
    def __init__(self, users: dict[str, VendorUser]) -> None:
        self._users = users

    def get_by_id(self, user_id: str) -> VendorUser | None:
        return self._users.get(user_id)

    def list_all(self) -> tuple[VendorUser, ...]:
        return tuple(self._users.values())


def _setup_services():
    users: dict[str, VendorUser] = {}
    sessions: dict[str, RefreshSession] = {}
    clock = _FakeClock(datetime(2026, 11, 26, 9, 0, tzinfo=UTC))
    id_gen = _SequentialIdGenerator()
    pw_hasher = ScryptPasswordHasher()
    token_hasher = Sha256TokenHasher()
    jwt_issuer = Hs256JwtTokenIssuer(
        secret_key="test-secret-key-at-least-32-characters-long",
        issuer="pharmacy-domain",
    )
    uow_factory = lambda: _FakeUoW(users, sessions)  # noqa: E731
    read_gateway = _FakeReadGateway(users)

    auth_cmd = VendorAuthCommandService(
        uow_factory=uow_factory,
        clock=clock,
        id_generator=id_gen,
        password_hasher=pw_hasher,
        token_hasher=token_hasher,
        jwt_issuer=jwt_issuer,
    )
    user_cmd = VendorUserCommandService(
        uow_factory=uow_factory,
        clock=clock,
        id_generator=id_gen,
        password_hasher=pw_hasher,
    )
    user_qry = VendorUserQueryService(read_gateway=read_gateway)
    verifier = VendorTokenVerifierService(
        jwt_issuer=jwt_issuer,
        read_gateway=read_gateway,
        clock=clock,
    )
    return clock, auth_cmd, user_cmd, user_qry, verifier


def test_bootstrap_login_refresh_rotation_reuse_and_logout() -> None:
    clock, auth_cmd, user_cmd, user_qry, verifier = _setup_services()

    admin = auth_cmd.bootstrap_initial_admin(
        BootstrapVendorAdminInput(
            email="Admin@Example.COM",
            display_name="初期管理者",
            password="AdminPassword123!",
        )
    )
    assert admin.email == "admin@example.com"
    assert admin.role == "admin"

    with pytest.raises(ApplicationConflictError) as exc_info:
        auth_cmd.bootstrap_initial_admin(
            BootstrapVendorAdminInput(
                email="admin2@example.com",
                display_name="2人目",
                password="AdminPassword123!",
            )
        )
    assert exc_info.value.code == "BOOTSTRAP_ADMIN_ALREADY_EXISTS"

    session1 = auth_cmd.login(
        VendorLoginInput(email="admin@example.com", password="AdminPassword123!")
    )
    assert session1.access_token_expires_in_seconds == 1800
    assert session1.refresh_token_expires_in_seconds == 28800

    principal = verifier.verify_access_token(session1.access_token)
    assert principal.user_id == admin.id

    # 30分経過後はアクセストークン期限切れ、480分未満なのでリフレッシュ可能。
    clock.advance(minutes=30)
    with pytest.raises(ApplicationAuthenticationError) as expired_exc:
        verifier.verify_access_token(session1.access_token)
    assert expired_exc.value.code == "AUTH_TOKEN_EXPIRED"

    session2 = auth_cmd.refresh(RefreshVendorSessionInput(refresh_token=session1.refresh_token))
    assert session2.refresh_token != session1.refresh_token

    # 使用済みの session1 リフレッシュトークンを再利用するとファミリー全失効。
    with pytest.raises(ApplicationAuthenticationError) as reuse_exc:
        auth_cmd.refresh(RefreshVendorSessionInput(refresh_token=session1.refresh_token))
    assert reuse_exc.value.code == "REFRESH_TOKEN_REVOKED"

    # 新しく発行されていた session2 もファミリー失効により拒否される。
    with pytest.raises(ApplicationAuthenticationError) as revoked_exc:
        auth_cmd.refresh(RefreshVendorSessionInput(refresh_token=session2.refresh_token))
    assert revoked_exc.value.code == "REFRESH_TOKEN_REVOKED"

    # 新規ログイン → 社員作成 → 一般社員の権限制限確認 → ログアウト即時失効。
    session3 = auth_cmd.login(
        VendorLoginInput(email="admin@example.com", password="AdminPassword123!")
    )
    member = user_cmd.create_vendor_user(
        admin.id,
        CreateVendorUserInput(
            email="member@example.com",
            display_name="運用社員",
            role="member",
            password="MemberPassword123!",
        ),
    )
    assert member.role == "member"
    assert user_qry.list_vendor_users(admin.id).total == 2

    with pytest.raises(ApplicationAuthorizationError) as forbidden_exc:
        user_qry.list_vendor_users(member.id)
    assert forbidden_exc.value.code == "VENDOR_ADMIN_REQUIRED"

    auth_cmd.logout(LogoutVendorSessionInput(refresh_token=session3.refresh_token))
    with pytest.raises(ApplicationAuthenticationError):
        auth_cmd.refresh(RefreshVendorSessionInput(refresh_token=session3.refresh_token))
