"""Hs256JwtTokenIssuer と Sha256TokenHasher の単体テスト。"""

from datetime import UTC, datetime, timedelta

import pytest

from app.application.foundation.errors import ApplicationAuthenticationError
from app.domain.auth.identifiers import (
    RefreshSessionId,
    RefreshTokenFamilyId,
    TenantId,
    UserId,
)
from app.domain.auth.value_objects import AffiliationType, AuthScope, RoleName, TokenType
from app.infrastructure.security.jwt_codec import Hs256JwtTokenIssuer, Sha256TokenHasher


def test_jwt_issue_verify_and_expiration() -> None:
    issuer = Hs256JwtTokenIssuer(
        secret_key="test-secret-key-at-least-32-characters-long",
        issuer="pharmacy-domain",
    )
    now = datetime(2026, 11, 26, 9, 0, tzinfo=UTC)
    user_id = UserId("user-1")
    scope = AuthScope.vendor()
    roles = (RoleName.VENDOR_ADMIN,)

    access_token = issuer.issue_access_token(
        user_id=user_id,
        scope=scope,
        roles=roles,
        token_id="jti-1",
        now=now,
    )
    refresh_token = issuer.issue_refresh_token(
        user_id=user_id,
        scope=scope,
        roles=roles,
        session_id=RefreshSessionId("sess-1"),
        family_id=RefreshTokenFamilyId("fam-1"),
        now=now,
    )

    access_claims = issuer.verify_token(
        access_token,
        expected_type=TokenType.ACCESS,
        now=now + timedelta(minutes=29),
    )
    assert access_claims.subject == "user-1"
    assert access_claims.scope == scope
    assert access_claims.roles == roles

    tenant_token = issuer.issue_access_token(
        user_id=UserId("user-2"),
        scope=AuthScope.tenant(TenantId("corp-1")),
        roles=(RoleName.PHARMACIST,),
        token_id="jti-2",
        now=now,
    )
    tenant_claims = issuer.verify_token(tenant_token, expected_type=TokenType.ACCESS, now=now)
    assert tenant_claims.scope.scope_type == AffiliationType.TENANT
    assert tenant_claims.scope.tenant_id == TenantId("corp-1")
    assert tenant_claims.roles == (RoleName.PHARMACIST,)

    with pytest.raises(ApplicationAuthenticationError) as exp_exc:
        issuer.verify_token(
            access_token,
            expected_type=TokenType.ACCESS,
            now=now + timedelta(minutes=30),
        )
    assert exp_exc.value.code == "AUTH_TOKEN_EXPIRED"

    with pytest.raises(ApplicationAuthenticationError) as type_exc:
        issuer.verify_token(
            access_token,
            expected_type=TokenType.REFRESH,
            now=now,
        )
    assert type_exc.value.code == "REFRESH_TOKEN_INVALID"

    refresh_claims = issuer.verify_token(
        refresh_token,
        expected_type=TokenType.REFRESH,
        now=now + timedelta(minutes=479),
    )
    assert refresh_claims.family_id == "fam-1"

    with pytest.raises(ApplicationAuthenticationError):
        issuer.verify_token(
            refresh_token,
            expected_type=TokenType.REFRESH,
            now=now + timedelta(minutes=480),
        )

    token_hasher = Sha256TokenHasher()
    assert len(token_hasher.hash_token(refresh_token).value) == 64

    for expected_type, expected_code in (
        (TokenType.ACCESS, "AUTH_TOKEN_INVALID"),
        (TokenType.REFRESH, "REFRESH_TOKEN_INVALID"),
    ):
        with pytest.raises(ApplicationAuthenticationError) as malformed_exc:
            issuer.verify_token("é.e.e", expected_type=expected_type, now=now)
        assert malformed_exc.value.code == expected_code
