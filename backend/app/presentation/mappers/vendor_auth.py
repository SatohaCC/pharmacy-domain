"""システムベンダー認証 API の DTO ⇔ 公開契約変換マッパー。"""

from app.application.vendor_auth.contracts import (
    CreateVendorUserInput,
    VendorAuthSessionView,
    VendorLoginInput,
    VendorUserListResult,
    VendorUserView,
)
from app.presentation.dto.vendor_auth import (
    CreateVendorUserRequest,
    VendorAuthSessionResponse,
    VendorLoginRequest,
    VendorUserListResponse,
    VendorUserResponse,
)


def to_vendor_login_input(payload: VendorLoginRequest) -> VendorLoginInput:
    """ログイン DTO をユースケース入力へ変換する。"""
    return VendorLoginInput(email=payload.email, password=payload.password)


def to_create_vendor_user_input(payload: CreateVendorUserRequest) -> CreateVendorUserInput:
    """社員発行 DTO をユースケース入力へ変換する。"""
    return CreateVendorUserInput(
        email=payload.email,
        display_name=payload.display_name,
        role=payload.role,
        password=payload.password,
    )


def to_vendor_user_response(view: VendorUserView) -> VendorUserResponse:
    """VendorUserView をレスポンス DTO へ変換する。"""
    return VendorUserResponse(
        id=view.id,
        email=view.email,
        display_name=view.display_name,
        role=view.role,
        status=view.status,
        created_at=view.created_at,
        updated_at=view.updated_at,
    )


def to_vendor_auth_session_response(
    session: VendorAuthSessionView,
) -> VendorAuthSessionResponse:
    """VendorAuthSessionView を公開セッションレスポンス DTO へ変換する（生トークンは除外）。"""
    return VendorAuthSessionResponse(
        user=to_vendor_user_response(session.user),
        access_token_expires_in_seconds=session.access_token_expires_in_seconds,
        refresh_token_expires_in_seconds=session.refresh_token_expires_in_seconds,
    )


def to_vendor_user_list_response(result: VendorUserListResult) -> VendorUserListResponse:
    """VendorUserListResult を一覧レスポンス DTO へ変換する。"""
    return VendorUserListResponse(
        items=[to_vendor_user_response(item) for item in result.items],
        total=result.total,
    )
