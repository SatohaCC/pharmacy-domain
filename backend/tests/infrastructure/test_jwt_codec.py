"""Hs256JwtTokenIssuer と Sha256TokenHasher の単体テスト。"""

from datetime import UTC, datetime, timedelta

import pytest

from app.application.foundation.errors import ApplicationAuthenticationError
from app.domain.vendor_auth.identifiers import (
    RefreshSessionId,
    RefreshTokenFamilyId,
    VendorUserId,
)
from app.domain.vendor_auth.value_objects import VendorRole, VendorTokenType
from app.infrastructure.security.jwt_codec import Hs256JwtTokenIssuer, Sha256TokenHasher


def test_jwt_issue_verify_and_expiration() -> None:
    issuer = Hs256JwtTokenIssuer(
        secret_key="test-secret-key-at-least-32-characters-long",
        issuer="pharmacy-domain",
    )
    now = datetime(2026, 11, 26, 9, 0, tzinfo=UTC)
    user_id = VendorUserId("user-1")
    access_token = issuer.issue_access_token(
        user_id=user_id,
        role=VendorRole.ADMIN,
        token_id="jti-1",
        now=now,
    )
    refresh_token = issuer.issue_refresh_token(
        user_id=user_id,
        role=VendorRole.ADMIN,
        session_id=RefreshSessionId("sess-1"),
        family_id=RefreshTokenFamilyId("fam-1"),
        now=now,
    )

    access_claims = issuer.verify_token(
        access_token,
        expected_type=VendorTokenType.ACCESS,
        now=now + timedelta(minutes=29),
    )
    assert access_claims.subject == "user-1"
    assert access_claims.role == VendorRole.ADMIN

    with pytest.raises(ApplicationAuthenticationError) as exp_exc:
        issuer.verify_token(
            access_token,
            expected_type=VendorTokenType.ACCESS,
            now=now + timedelta(minutes=30),
        )
    assert exp_exc.value.code == "AUTH_TOKEN_EXPIRED"

    # アクセストークンをリフレッシュトークンとして検証すると拒否される。
    with pytest.raises(ApplicationAuthenticationError) as type_exc:
        issuer.verify_token(
            access_token,
            expected_type=VendorTokenType.REFRESH,
            now=now,
        )
    assert type_exc.value.code == "REFRESH_TOKEN_INVALID"

    refresh_claims = issuer.verify_token(
        refresh_token,
        expected_type=VendorTokenType.REFRESH,
        now=now + timedelta(minutes=479),
    )
    assert refresh_claims.family_id == "fam-1"

    with pytest.raises(ApplicationAuthenticationError):
        issuer.verify_token(
            refresh_token,
            expected_type=VendorTokenType.REFRESH,
            now=now + timedelta(minutes=480),
        )

    token_hasher = Sha256TokenHasher()
    assert len(token_hasher.hash_token(refresh_token).value) == 64
