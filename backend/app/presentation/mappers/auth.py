"""共通認証 API の DTO ⇔ 公開契約変換マッパー。"""

from app.application.auth.contracts import (
    AuthLoginInput,
    AuthSessionView,
    AuthUserListResult,
    AuthUserView,
    CreateVendorUserInput,
)
from app.presentation.dto.auth import (
    AuthLoginRequest,
    AuthSessionResponse,
    AuthUserListResponse,
    AuthUserResponse,
    CreateVendorUserV2Request,
)


def to_auth_login_input(payload: AuthLoginRequest) -> AuthLoginInput:
    """ログイン DTO をユースケース入力へ変換する。"""
    return AuthLoginInput(
        email=payload.email,
        password=payload.password,
        scope_type=payload.scope_type,
        tenant_id=payload.tenant_id,
    )


def to_create_vendor_user_v2_input(payload: CreateVendorUserV2Request) -> CreateVendorUserInput:
    """社員発行 DTO をユースケース入力へ変換する。"""
    return CreateVendorUserInput(
        email=payload.email,
        display_name=payload.display_name,
        roles=tuple(payload.roles),
        password=payload.password,
    )


def to_auth_user_response(view: AuthUserView) -> AuthUserResponse:
    """AuthUserView をレスポンス DTO へ変換する。"""
    return AuthUserResponse(
        id=view.id,
        email=view.email,
        display_name=view.display_name,
        affiliation_type=view.affiliation_type,
        tenant_id=view.tenant_id,
        roles=list(view.roles),
        status=view.status,
        created_at=view.created_at,
        updated_at=view.updated_at,
    )


def to_auth_session_response(session: AuthSessionView) -> AuthSessionResponse:
    """AuthSessionView を公開セッションレスポンス DTO へ変換する（生トークン除外）。"""
    return AuthSessionResponse(
        user=to_auth_user_response(session.user),
        access_token_expires_in_seconds=session.access_token_expires_in_seconds,
        refresh_token_expires_in_seconds=session.refresh_token_expires_in_seconds,
    )


def to_auth_user_list_response(result: AuthUserListResult) -> AuthUserListResponse:
    """AuthUserListResult を一覧レスポンス DTO へ変換する。"""
    return AuthUserListResponse(
        items=[to_auth_user_response(item) for item in result.items],
        total=result.total,
    )
