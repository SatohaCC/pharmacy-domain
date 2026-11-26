"""標準ライブラリによる HS256 JWT 発行・検証および SHA-256 トークンハッシュ実装。"""

import base64
import hashlib
import hmac
import json
import re
from datetime import UTC, datetime, timedelta

from app.application.foundation.errors import ApplicationAuthenticationError
from app.application.vendor_auth.ports import VerifiedTokenClaims
from app.domain.vendor_auth.entities import (
    ACCESS_TOKEN_TTL_MINUTES,
    REFRESH_TOKEN_TTL_MINUTES,
)
from app.domain.vendor_auth.identifiers import (
    RefreshSessionId,
    RefreshTokenFamilyId,
    VendorUserId,
)
from app.domain.vendor_auth.primitives import TokenHash
from app.domain.vendor_auth.value_objects import VendorRole, VendorTokenType

_SUBJECT_TYPE_VENDOR = "vendor"
_B64URL_SEGMENT_PATTERN = re.compile(r"^[A-Za-z0-9_-]+$")


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(segment: str) -> bytes:
    if not _B64URL_SEGMENT_PATTERN.fullmatch(segment):
        raise ValueError("不正な Base64URL セグメントです。")
    padding = "=" * (-len(segment) % 4)
    return base64.urlsafe_b64decode((segment + padding).encode("ascii"))


class Sha256TokenHasher:
    """リフレッシュトークンの SHA-256 hex ハッシュ生成器。"""

    def hash_token(self, raw_token: str) -> TokenHash:
        """トークン文字列の SHA-256 hex ダイジェストを返す。"""
        digest = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
        return TokenHash(digest)


class Hs256JwtTokenIssuer:
    """RFC 7519 HS256 JWT の発行・検証実装。"""

    def __init__(self, *, secret_key: str, issuer: str) -> None:
        if len(secret_key) < 32:
            raise ValueError("JWT シークレットキーは 32 文字以上である必要があります。")
        self._secret_bytes = secret_key.encode("utf-8")
        self._issuer = issuer

    def issue_access_token(
        self,
        *,
        user_id: VendorUserId,
        role: VendorRole,
        token_id: str,
        now: datetime,
    ) -> str:
        """有効期限 30 分のアクセストークンを発行する。"""
        expires_at = now + timedelta(minutes=ACCESS_TOKEN_TTL_MINUTES)
        payload: dict[str, object] = {
            "iss": self._issuer,
            "sub": user_id.value,
            "jti": token_id,
            "iat": int(now.timestamp()),
            "exp": int(expires_at.timestamp()),
            "token_type": VendorTokenType.ACCESS.value,
            "subject_type": _SUBJECT_TYPE_VENDOR,
            "role": role.value,
        }
        return self._encode(payload)

    def issue_refresh_token(
        self,
        *,
        user_id: VendorUserId,
        role: VendorRole,
        session_id: RefreshSessionId,
        family_id: RefreshTokenFamilyId,
        now: datetime,
    ) -> str:
        """有効期限 480 分のリフレッシュトークンを発行する。"""
        expires_at = now + timedelta(minutes=REFRESH_TOKEN_TTL_MINUTES)
        payload: dict[str, object] = {
            "iss": self._issuer,
            "sub": user_id.value,
            "jti": session_id.value,
            "family_id": family_id.value,
            "iat": int(now.timestamp()),
            "exp": int(expires_at.timestamp()),
            "token_type": VendorTokenType.REFRESH.value,
            "subject_type": _SUBJECT_TYPE_VENDOR,
            "role": role.value,
        }
        return self._encode(payload)

    def verify_token(
        self,
        raw_token: str,
        *,
        expected_type: VendorTokenType,
        now: datetime,
    ) -> VerifiedTokenClaims:
        """JWT のヘッダ・署名・発行者・種別・有効期限を検証する。"""
        invalid_code = (
            "REFRESH_TOKEN_INVALID"
            if expected_type == VendorTokenType.REFRESH
            else "AUTH_TOKEN_INVALID"
        )
        parts = raw_token.split(".")
        if len(parts) != 3 or any(not _B64URL_SEGMENT_PATTERN.fullmatch(part) for part in parts):
            raise ApplicationAuthenticationError("トークン形式が不正です。", code=invalid_code)

        header_seg, payload_seg, sig_seg = parts
        signing_input = f"{header_seg}.{payload_seg}".encode("ascii")
        expected_sig = hmac.new(self._secret_bytes, signing_input, hashlib.sha256).digest()
        try:
            actual_sig = _b64url_decode(sig_seg)
        except ValueError as exc:
            raise ApplicationAuthenticationError(
                "トークン署名が不正です。", code=invalid_code
            ) from exc

        if not hmac.compare_digest(actual_sig, expected_sig):
            raise ApplicationAuthenticationError("トークン署名が不正です。", code=invalid_code)

        try:
            header = json.loads(_b64url_decode(header_seg).decode("utf-8"))
            payload = json.loads(_b64url_decode(payload_seg).decode("utf-8"))
        except (ValueError, UnicodeDecodeError) as exc:
            raise ApplicationAuthenticationError(
                "トークン構造が不正です。", code=invalid_code
            ) from exc

        if (
            not isinstance(header, dict)
            or header.get("alg") != "HS256"
            or header.get("typ") != "JWT"
        ):
            raise ApplicationAuthenticationError("トークンヘッダが不正です。", code=invalid_code)

        if not isinstance(payload, dict):
            raise ApplicationAuthenticationError(
                "トークンペイロードが不正です。", code=invalid_code
            )

        if (
            payload.get("iss") != self._issuer
            or payload.get("subject_type") != _SUBJECT_TYPE_VENDOR
            or payload.get("token_type") != expected_type.value
        ):
            raise ApplicationAuthenticationError(
                "トークン種別または発行者が不正です。", code=invalid_code
            )

        sub = payload.get("sub")
        jti = payload.get("jti")
        role_raw = payload.get("role")
        iat_raw = payload.get("iat")
        exp_raw = payload.get("exp")
        family_raw = payload.get("family_id")

        if (
            not isinstance(sub, str)
            or not sub
            or not isinstance(jti, str)
            or not jti
            or not isinstance(role_raw, str)
            or isinstance(iat_raw, bool)
            or not isinstance(iat_raw, int)
            or isinstance(exp_raw, bool)
            or not isinstance(exp_raw, int)
        ):
            raise ApplicationAuthenticationError("トークンクレームが不正です。", code=invalid_code)

        try:
            role = VendorRole(role_raw)
        except ValueError as exc:
            raise ApplicationAuthenticationError(
                "トークンロールが不正です。", code=invalid_code
            ) from exc

        if expected_type == VendorTokenType.REFRESH and (
            not isinstance(family_raw, str) or not family_raw
        ):
            raise ApplicationAuthenticationError(
                "トークンファミリーが不正です。", code=invalid_code
            )

        if int(now.timestamp()) >= exp_raw:
            raise ApplicationAuthenticationError(
                "トークンの有効期限が切れています。",
                code="AUTH_TOKEN_EXPIRED",
            )

        return VerifiedTokenClaims(
            subject=sub,
            token_id=jti,
            token_type=expected_type,
            role=role,
            family_id=family_raw if isinstance(family_raw, str) else None,
            issued_at=datetime.fromtimestamp(iat_raw, tz=UTC),
            expires_at=datetime.fromtimestamp(exp_raw, tz=UTC),
        )

    def _encode(self, payload: dict[str, object]) -> str:
        header = {"alg": "HS256", "typ": "JWT"}
        header_seg = _b64url_encode(
            json.dumps(header, separators=(",", ":"), sort_keys=True).encode("utf-8")
        )
        payload_seg = _b64url_encode(
            json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
        )
        signing_input = f"{header_seg}.{payload_seg}".encode("ascii")
        signature = hmac.new(self._secret_bytes, signing_input, hashlib.sha256).digest()
        return f"{header_seg}.{payload_seg}.{_b64url_encode(signature)}"
