"""旧 /api/vendor/* 互換エンドポイント（PR #3 のフロントエンド切替後に撤去）。"""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Request, Response, status

from app.application.auth.contracts import (
    AuthCommandPort,
    AuthLoginInput,
    AuthPrincipal,
    AuthSessionView,
    AuthUserListResult,
    AuthUserQueryPort,
    AuthUserView,
    CreateVendorUserInput,
    LogoutAuthSessionInput,
    RefreshAuthSessionInput,
    VendorUserCommandPort,
)
from app.presentation.auth_cookies import clear_auth_cookies, set_auth_cookies
from app.presentation.dependencies import (
    AUTH_REFRESH_COOKIE_NAME,
    VENDOR_REFRESH_COOKIE_NAME,
    get_auth_commands,
    get_auth_user_queries,
    get_current_auth_principal,
    get_vendor_user_commands,
    require_role,
    verify_csrf_origin,
)
from app.presentation.dto.error import ErrorResponse
from app.presentation.dto.vendor_auth import (
    CreateVendorUserRequest,
    VendorAuthSessionResponse,
    VendorLoginRequest,
    VendorUserListResponse,
    VendorUserResponse,
)

router = APIRouter(prefix="/api/vendor", tags=["vendor-auth-legacy"])


def _to_legacy_role(view: AuthUserView) -> str:
    return "admin" if "vendor_admin" in view.roles else "member"


def _to_legacy_user_response(view: AuthUserView) -> VendorUserResponse:
    return VendorUserResponse(
        id=view.id,
        email=view.email,
        display_name=view.display_name,
        role=_to_legacy_role(view),  # type: ignore[arg-type]
        status=view.status,
        created_at=view.created_at,
        updated_at=view.updated_at,
    )


def _to_legacy_session_response(session: AuthSessionView) -> VendorAuthSessionResponse:
    return VendorAuthSessionResponse(
        user=_to_legacy_user_response(session.user),
        access_token_expires_in_seconds=session.access_token_expires_in_seconds,
        refresh_token_expires_in_seconds=session.refresh_token_expires_in_seconds,
    )


def _to_legacy_list_response(result: AuthUserListResult) -> VendorUserListResponse:
    return VendorUserListResponse(
        items=[_to_legacy_user_response(item) for item in result.items],
        total=result.total,
    )


@router.post(
    "/auth/login",
    response_model=VendorAuthSessionResponse,
    responses={401: {"model": ErrorResponse}, 422: {"model": ErrorResponse}},
)
def login_vendor_user(
    payload: VendorLoginRequest,
    request: Request,
    response: Response,
    commands: Annotated[AuthCommandPort, Depends(get_auth_commands)],
) -> VendorAuthSessionResponse:
    """旧ベンダーログイン互換エンドポイント。"""
    session = commands.login(
        AuthLoginInput(email=payload.email, password=payload.password, scope_type="vendor")
    )
    set_auth_cookies(request, response, session)
    return _to_legacy_session_response(session)


@router.post(
    "/auth/refresh",
    response_model=VendorAuthSessionResponse,
    responses={401: {"model": ErrorResponse}, 403: {"model": ErrorResponse}},
    dependencies=[Depends(verify_csrf_origin)],
)
def refresh_vendor_session(
    request: Request,
    response: Response,
    commands: Annotated[AuthCommandPort, Depends(get_auth_commands)],
) -> VendorAuthSessionResponse:
    """旧ベンダーリフレッシュ互換エンドポイント。"""
    raw_refresh = request.cookies.get(VENDOR_REFRESH_COOKIE_NAME, "") or request.cookies.get(
        AUTH_REFRESH_COOKIE_NAME, ""
    )
    session = commands.refresh(RefreshAuthSessionInput(refresh_token=raw_refresh))
    set_auth_cookies(request, response, session)
    return _to_legacy_session_response(session)


@router.post(
    "/auth/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={403: {"model": ErrorResponse}},
    dependencies=[Depends(verify_csrf_origin)],
)
def logout_vendor_user(
    request: Request,
    commands: Annotated[AuthCommandPort, Depends(get_auth_commands)],
) -> Response:
    """旧ベンダーログアウト互換エンドポイント。"""
    raw_refresh = request.cookies.get(VENDOR_REFRESH_COOKIE_NAME) or request.cookies.get(
        AUTH_REFRESH_COOKIE_NAME
    )
    commands.logout(LogoutAuthSessionInput(refresh_token=raw_refresh))
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    clear_auth_cookies(request, response)
    return response


@router.get(
    "/auth/me",
    response_model=VendorUserResponse,
    responses={401: {"model": ErrorResponse}},
)
def get_current_vendor_user(
    principal: Annotated[AuthPrincipal, Depends(get_current_auth_principal)],
    queries: Annotated[AuthUserQueryPort, Depends(get_auth_user_queries)],
) -> VendorUserResponse:
    """旧ベンダーログインユーザー情報取得互換エンドポイント。"""
    return _to_legacy_user_response(queries.get_current_user(principal.user_id))


@router.get(
    "/users",
    response_model=VendorUserListResponse,
    responses={401: {"model": ErrorResponse}, 403: {"model": ErrorResponse}},
)
def list_vendor_users(
    principal: Annotated[
        AuthPrincipal,
        Depends(require_role("vendor_admin", scope_type="vendor")),
    ],
    queries: Annotated[AuthUserQueryPort, Depends(get_auth_user_queries)],
) -> VendorUserListResponse:
    """旧ベンダーユーザー一覧互換エンドポイント。"""
    return _to_legacy_list_response(queries.list_vendor_users(principal.user_id))


@router.post(
    "/users",
    response_model=VendorUserResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        401: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
        409: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
    },
    dependencies=[Depends(verify_csrf_origin)],
)
def create_vendor_user(
    payload: CreateVendorUserRequest,
    principal: Annotated[
        AuthPrincipal,
        Depends(require_role("vendor_admin", scope_type="vendor")),
    ],
    commands: Annotated[VendorUserCommandPort, Depends(get_vendor_user_commands)],
) -> VendorUserResponse:
    """旧ベンダー社員発行互換エンドポイント。"""
    mapped_role: Literal["vendor_admin", "vendor_member"] = (
        "vendor_admin" if payload.role == "admin" else "vendor_member"
    )
    created = commands.create_vendor_user(
        principal.user_id,
        CreateVendorUserInput(
            email=payload.email,
            display_name=payload.display_name,
            roles=(mapped_role,),
            password=payload.password,
        ),
    )
    return _to_legacy_user_response(created)
