"""User・RoleAssignment・RefreshSession・AuthScope の単体テスト。"""

from datetime import UTC, datetime, timedelta

import pytest

from app.domain.auth.entities import (
    ACCESS_TOKEN_TTL_MINUTES,
    REFRESH_TOKEN_TTL_MINUTES,
    RefreshSession,
    RoleAssignment,
    User,
)
from app.domain.auth.exceptions import InvalidCredentialsError, ScopeViolationError
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
from app.domain.auth.value_objects import AffiliationType, AuthScope, RoleName, UserStatus
from app.domain.foundation.exceptions import DomainValidationError
from app.domain.foundation.primitives import AwareDatetime


def _now(offset_minutes: int = 0) -> AwareDatetime:
    base = datetime(2026, 11, 26, 9, 0, tzinfo=UTC)
    return AwareDatetime(base + timedelta(minutes=offset_minutes))


def test_auth_scope_invariants() -> None:
    vendor_scope = AuthScope.vendor()
    assert vendor_scope.scope_type == AffiliationType.VENDOR
    assert vendor_scope.tenant_id is None

    tenant_scope = AuthScope.tenant(TenantId("corp-1"))
    assert tenant_scope.scope_type == AffiliationType.TENANT
    assert tenant_scope.tenant_id == TenantId("corp-1")

    with pytest.raises(ScopeViolationError):
        AuthScope(scope_type=AffiliationType.VENDOR, tenant_id=TenantId("corp-1"))
    with pytest.raises(ScopeViolationError):
        AuthScope(scope_type=AffiliationType.TENANT, tenant_id=None)


def test_role_assignment_enforces_scope_and_single_affiliation() -> None:
    vendor_user = User.create_bootstrap_vendor_admin(
        user_id=UserId("user-1"),
        email=UserEmail.parse("admin@vendor.example.com"),
        display_name=UserDisplayName.parse("ベンダー管理者"),
        password_hash=PasswordHash("scrypt$dummy"),
        now=_now(),
    )
    tenant_user = User.create_tenant_user(
        actor_id=vendor_user.id,
        user_id=UserId("user-2"),
        tenant_id=TenantId("corp-1"),
        email=UserEmail.parse("pharmacist@corp1.example.com"),
        display_name=UserDisplayName.parse("薬局薬剤師"),
        password_hash=PasswordHash("scrypt$dummy"),
        now=_now(),
    )

    assignment = RoleAssignment.grant_to_user(
        assignment_id=RoleAssignmentId("ra-1"),
        user=vendor_user,
        role=RoleName.VENDOR_ADMIN,
        scope=AuthScope.vendor(),
        valid_from=_now(0),
        valid_to=_now(60),
        granted_at=_now(0),
    )
    assert assignment.is_active_at(_now(0)) is True
    assert assignment.is_active_at(_now(59)) is True
    assert assignment.is_active_at(_now(60)) is False

    assignment.revoke(_now(10))
    assert assignment.is_active_at(_now(10)) is False

    # ロール種別とスコープ種別の不一致は拒否される。
    with pytest.raises(ScopeViolationError):
        RoleAssignment.grant_to_user(
            assignment_id=RoleAssignmentId("ra-bad-1"),
            user=vendor_user,
            role=RoleName.PHARMACIST,
            scope=AuthScope.vendor(),
            valid_from=_now(),
            granted_at=_now(),
        )

    # 1 ユーザー 1 所属制約: 別スコープのロール付与は拒否される。
    with pytest.raises(ScopeViolationError):
        RoleAssignment.grant_to_user(
            assignment_id=RoleAssignmentId("ra-bad-2"),
            user=vendor_user,
            role=RoleName.TENANT_ADMIN,
            scope=AuthScope.tenant(TenantId("corp-1")),
            valid_from=_now(),
            granted_at=_now(),
        )

    # 別テナントへのロール付与も拒否される。
    with pytest.raises(ScopeViolationError):
        RoleAssignment.grant_to_user(
            assignment_id=RoleAssignmentId("ra-bad-3"),
            user=tenant_user,
            role=RoleName.PHARMACIST,
            scope=AuthScope.tenant(TenantId("corp-2")),
            valid_from=_now(),
            granted_at=_now(),
        )

    # 半開区間の逆転は拒否される。
    with pytest.raises(DomainValidationError):
        RoleAssignment.grant_to_user(
            assignment_id=RoleAssignmentId("ra-bad-4"),
            user=vendor_user,
            role=RoleName.VENDOR_MEMBER,
            scope=AuthScope.vendor(),
            valid_from=_now(10),
            valid_to=_now(10),
            granted_at=_now(),
        )


def test_user_affiliation_is_read_only_after_creation() -> None:
    tenant_id = TenantId("corp-1")
    user = User.create_tenant_user(
        actor_id=None,
        user_id=UserId("user-1"),
        tenant_id=tenant_id,
        email=UserEmail.parse("pharmacist@corp1.example.com"),
        display_name=UserDisplayName.parse("薬剤師"),
        password_hash=PasswordHash("scrypt$dummy"),
        now=_now(),
    )

    with pytest.raises(AttributeError):
        user.affiliation = AuthScope.tenant(TenantId("corp-2"))
    assert user.affiliation == AuthScope.tenant(tenant_id)

    with pytest.raises(AttributeError):
        del user.affiliation
    assert user.affiliation == AuthScope.tenant(tenant_id)


def test_disabled_user_cannot_authenticate() -> None:
    user = User.create_bootstrap_vendor_admin(
        user_id=UserId("user-1"),
        email=UserEmail.parse("admin@vendor.example.com"),
        display_name=UserDisplayName.parse("管理者"),
        password_hash=PasswordHash("scrypt$dummy"),
        now=_now(),
    )
    user.disable(_now(5))
    assert user.status == UserStatus.DISABLED
    assert user.updated_at == _now(5)
    with pytest.raises(InvalidCredentialsError):
        user.ensure_can_authenticate()


def test_refresh_session_ttl_rotation_and_revocation() -> None:
    assert ACCESS_TOKEN_TTL_MINUTES == 30
    assert REFRESH_TOKEN_TTL_MINUTES == 480

    session = RefreshSession.issue(
        session_id=RefreshSessionId("sess-1"),
        family_id=RefreshTokenFamilyId("fam-1"),
        user_id=UserId("user-1"),
        scope=AuthScope.vendor(),
        token_hash=TokenHash("0" * 64),
        issued_at=_now(0),
    )

    assert session.expires_at == _now(480)
    assert session.is_active(_now(479)) is True
    assert session.is_expired(_now(480)) is True

    session.rotate(replaced_by_session_id=RefreshSessionId("sess-2"), now=_now(10))
    assert session.is_reused() is True
    assert session.is_active(_now(11)) is False

    session.revoke(_now(12))
    assert session.is_revoked() is True
