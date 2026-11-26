"""VendorUser と RefreshSession エンティティの単体テスト。"""

from datetime import UTC, datetime, timedelta

import pytest

from app.domain.foundation.primitives import AwareDatetime
from app.domain.vendor_auth.entities import (
    ACCESS_TOKEN_TTL_MINUTES,
    REFRESH_TOKEN_TTL_MINUTES,
    RefreshSession,
    VendorUser,
)
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


def _now(offset_minutes: int = 0) -> AwareDatetime:
    return AwareDatetime(
        datetime(2026, 11, 26, 9, 0, tzinfo=UTC) + timedelta(minutes=offset_minutes)
    )


def test_vendor_user_bootstrap_and_admin_creation() -> None:
    created_at = _now()
    admin = VendorUser.create_bootstrap_admin(
        user_id=VendorUserId("admin-1"),
        email=VendorEmail.parse("admin@example.com"),
        display_name=VendorDisplayName.parse("初期管理者"),
        password_hash=PasswordHash("scrypt$dummy"),
        now=created_at,
    )
    assert admin.role == VendorRole.ADMIN
    assert admin.status == VendorUserStatus.ACTIVE
    assert admin.created_by is None

    member = VendorUser.create_by_admin(
        actor=admin,
        user_id=VendorUserId("member-1"),
        email=VendorEmail.parse("member@example.com"),
        display_name=VendorDisplayName.parse("一般社員"),
        role=VendorRole.MEMBER,
        password_hash=PasswordHash("scrypt$dummy2"),
        now=created_at,
    )
    assert member.role == VendorRole.MEMBER
    assert member.created_by == admin.id

    with pytest.raises(VendorAdminRequiredError):
        VendorUser.create_by_admin(
            actor=member,
            user_id=VendorUserId("member-2"),
            email=VendorEmail.parse("member2@example.com"),
            display_name=VendorDisplayName.parse("許可されない作成"),
            role=VendorRole.MEMBER,
            password_hash=PasswordHash("scrypt$dummy3"),
            now=created_at,
        )


def test_disabled_vendor_user_cannot_authenticate_or_manage() -> None:
    admin = VendorUser.create_bootstrap_admin(
        user_id=VendorUserId("admin-1"),
        email=VendorEmail.parse("admin@example.com"),
        display_name=VendorDisplayName.parse("管理者"),
        password_hash=PasswordHash("scrypt$dummy"),
        now=_now(),
    )
    admin.disable(_now(5))

    assert admin.status == VendorUserStatus.DISABLED
    with pytest.raises(VendorCredentialsInvalidError):
        admin.ensure_can_authenticate()
    with pytest.raises(VendorAdminRequiredError):
        admin.ensure_can_manage_vendor_users()


def test_refresh_session_ttl_rotation_and_revocation() -> None:
    assert ACCESS_TOKEN_TTL_MINUTES == 30
    assert REFRESH_TOKEN_TTL_MINUTES == 480

    issued_at = _now(0)
    session = RefreshSession.issue(
        session_id=RefreshSessionId("sess-1"),
        family_id=RefreshTokenFamilyId("fam-1"),
        vendor_user_id=VendorUserId("admin-1"),
        token_hash=TokenHash("0" * 64),
        issued_at=issued_at,
    )

    assert session.expires_at == _now(480)
    assert session.is_active(_now(479)) is True
    assert session.is_expired(_now(480)) is True
    assert session.is_active(_now(480)) is False

    session.rotate(replaced_by_session_id=RefreshSessionId("sess-2"), now=_now(10))
    assert session.is_reused() is True
    assert session.is_active(_now(11)) is False

    session.revoke(_now(12))
    assert session.is_revoked() is True
