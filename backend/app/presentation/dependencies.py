"""FastAPI のリクエスト単位 DI プロバイダー。"""

from collections.abc import Callable
from typing import Annotated, cast
from urllib.parse import urlsplit

from fastapi import Depends, Request

from app.application.auth.contracts import (
    AffiliationTypeLiteral,
    AuthCommandPort,
    AuthPrincipal,
    AuthTokenVerifierPort,
    AuthUserQueryPort,
    RoleNameLiteral,
    VendorUserCommandPort,
)
from app.application.corporate.contracts import (
    CorporateRelationCommandPort,
    CorporateRelationQueryPort,
    CorporationCommandPort,
    CorporationQueryPort,
)
from app.application.foundation.errors import (
    ApplicationAuthenticationError,
    ApplicationAuthorizationError,
)

AUTH_ACCESS_COOKIE_NAME = "auth_access_token"
AUTH_REFRESH_COOKIE_NAME = "auth_refresh_token"
_SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})


def get_service_name(request: Request) -> str:
    """起動時に設定されたサービス名を取得する。"""
    return str(request.app.state.service_name)


def get_corporation_commands(request: Request) -> CorporationCommandPort:
    """Composition Root が配線した法人更新系（Command）ポートを取得する。"""
    commands = getattr(request.app.state, "corporation_commands", None)
    if commands is None:
        raise RuntimeError("CorporationCommandService が初期化されていません。")
    return cast(CorporationCommandPort, commands)


def get_corporation_queries(request: Request) -> CorporationQueryPort:
    """Composition Root が配線した法人参照系（Query）ポートを取得する。"""
    queries = getattr(request.app.state, "corporation_queries", None)
    if queries is None:
        raise RuntimeError("CorporationQueryService が初期化されていません。")
    return cast(CorporationQueryPort, queries)


def get_corporate_relation_commands(request: Request) -> CorporateRelationCommandPort:
    """配線済みの法人間関係の更新ポートを取得する。"""
    commands = getattr(request.app.state, "corporate_relation_commands", None)
    if commands is None:
        raise RuntimeError("CorporateRelationCommandService が初期化されていません。")
    return cast(CorporateRelationCommandPort, commands)


def get_corporate_relation_queries(request: Request) -> CorporateRelationQueryPort:
    """配線済みの法人間関係の参照ポートを取得する。"""
    queries = getattr(request.app.state, "corporate_relation_queries", None)
    if queries is None:
        raise RuntimeError("CorporateRelationQueryService が初期化されていません。")
    return cast(CorporateRelationQueryPort, queries)


def get_auth_commands(request: Request) -> AuthCommandPort:
    """配線済みの共通認証更新ポートを取得する。"""
    commands = getattr(request.app.state, "auth_commands", None)
    if commands is None:
        raise RuntimeError("AuthCommandService が初期化されていません。")
    return cast(AuthCommandPort, commands)


def get_vendor_user_commands(request: Request) -> VendorUserCommandPort:
    """配線済みのベンダーユーザー更新ポートを取得する。"""
    commands = getattr(request.app.state, "vendor_user_commands", None)
    if commands is None:
        raise RuntimeError("VendorUserCommandService が初期化されていません。")
    return cast(VendorUserCommandPort, commands)


def get_auth_user_queries(request: Request) -> AuthUserQueryPort:
    """配線済みの共通認証ユーザー参照ポートを取得する。"""
    queries = getattr(request.app.state, "auth_user_queries", None)
    if queries is None:
        raise RuntimeError("AuthUserQueryService が初期化されていません。")
    return cast(AuthUserQueryPort, queries)


def get_auth_token_verifier(request: Request) -> AuthTokenVerifierPort:
    """配線済みのアクセストークン検証ポートを取得する。"""
    verifier = getattr(request.app.state, "auth_token_verifier", None)
    if verifier is None:
        raise RuntimeError("AuthTokenVerifierService が初期化されていません。")
    return cast(AuthTokenVerifierPort, verifier)


def _extract_origin(raw_url: str) -> str:
    parsed = urlsplit(raw_url.strip())
    if not parsed.scheme or not parsed.netloc:
        return ""
    return f"{parsed.scheme.lower()}://{parsed.netloc.lower()}"


def verify_csrf_origin(request: Request) -> None:
    """Cookie 認証を伴う状態変更 API に対して Origin/Referer およびカスタムヘッダを検証する。"""
    if request.method.upper() in _SAFE_METHODS:
        return

    settings = getattr(request.app.state, "settings", None)
    allowed_origins = {
        origin.rstrip("/").lower()
        for origin in getattr(settings, "cors_origins", [])
        if isinstance(origin, str) and origin.strip()
    }
    request_origin = f"{request.url.scheme.lower()}://{request.url.netloc.lower()}"
    if request.url.netloc:
        allowed_origins.add(request_origin)

    origin = request.headers.get("origin")
    referer = request.headers.get("referer")
    requested_with = request.headers.get("x-requested-with", "").strip()

    if origin:
        if origin.rstrip("/").lower() not in allowed_origins:
            raise ApplicationAuthorizationError(
                "許可されていない送信元からのリクエストです。",
                code="CSRF_VALIDATION_FAILED",
            )
        return

    if referer:
        if _extract_origin(referer) not in allowed_origins:
            raise ApplicationAuthorizationError(
                "許可されていない送信元からのリクエストです。",
                code="CSRF_VALIDATION_FAILED",
            )
        return

    if requested_with == "XMLHttpRequest":
        return

    raise ApplicationAuthorizationError(
        "同一オリジン検証ヘッダが不足しています。",
        code="CSRF_VALIDATION_FAILED",
    )


def get_current_auth_principal(
    request: Request,
    verifier: Annotated[AuthTokenVerifierPort, Depends(get_auth_token_verifier)],
) -> AuthPrincipal:
    """HttpOnly Cookie のアクセストークンを検証して認証主体を返す。"""
    raw_token = request.cookies.get(AUTH_ACCESS_COOKIE_NAME)
    if not raw_token:
        raise ApplicationAuthenticationError(
            "認証が必要です。ログインしてください。",
            code="UNAUTHORIZED",
        )
    return verifier.verify_access_token(raw_token)


def require_any_role(
    *allowed_roles: RoleNameLiteral,
    scope_type: AffiliationTypeLiteral,
) -> Callable[[AuthPrincipal], AuthPrincipal]:
    """指定スコープかつ許可ロールのいずれかを持つ認証主体であることを検証する依存関数を返す。"""
    allowed = frozenset(allowed_roles)

    def _dependency(
        principal: Annotated[AuthPrincipal, Depends(get_current_auth_principal)],
    ) -> AuthPrincipal:
        if principal.scope_type != scope_type or not any(
            role in allowed for role in principal.roles
        ):
            error_code = (
                "VENDOR_ADMIN_REQUIRED"
                if allowed == frozenset({"vendor_admin"})
                else "INSUFFICIENT_ROLE"
            )
            raise ApplicationAuthorizationError(
                "この操作を実行する権限がありません。",
                code=error_code,
            )
        return principal

    return _dependency


def require_role(
    required_role: RoleNameLiteral,
    *,
    scope_type: AffiliationTypeLiteral,
) -> Callable[[AuthPrincipal], AuthPrincipal]:
    """指定スコープと必須ロールを持つ認証主体であることを検証する依存関数を返す。"""
    return require_any_role(required_role, scope_type=scope_type)


require_vendor_user = require_any_role("vendor_admin", "vendor_member", scope_type="vendor")
