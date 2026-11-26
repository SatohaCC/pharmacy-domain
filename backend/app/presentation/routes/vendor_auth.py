"""システムベンダー認証およびベンダーユーザー管理 API ルーター。"""

from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response, status

from app.application.vendor_auth.contracts import (
    LogoutVendorSessionInput,
    RefreshVendorSessionInput,
    VendorAuthCommandPort,
    VendorAuthPrincipal,
    VendorAuthSessionView,
    VendorUserCommandPort,
    VendorUserQueryPort,
)
from app.presentation.dependencies import (
    VENDOR_ACCESS_COOKIE_NAME,
    VENDOR_REFRESH_COOKIE_NAME,
    get_current_vendor_principal,
    get_vendor_auth_commands,
    get_vendor_user_commands,
    get_vendor_user_queries,
    require_vendor_admin,
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
from app.presentation.mappers.vendor_auth import (
    to_create_vendor_user_input,
    to_vendor_auth_session_response,
    to_vendor_login_input,
    to_vendor_user_list_response,
    to_vendor_user_response,
)

router = APIRouter(prefix="/api/vendor", tags=["vendor-auth"])

_ACCESS_COOKIE_PATH = "/api"
_REFRESH_COOKIE_PATH = "/api/vendor/auth"


def _is_cookie_secure(request: Request) -> bool:
    settings = getattr(request.app.state, "settings", None)
    return bool(getattr(settings, "auth_cookie_secure", False))


def _set_auth_cookies(
    response: Response,
    *,
    session: VendorAuthSessionView,
    secure: bool,
) -> None:
    response.set_cookie(
        key=VENDOR_ACCESS_COOKIE_NAME,
        value=session.access_token,
        max_age=session.access_token_expires_in_seconds,
        path=_ACCESS_COOKIE_PATH,
        httponly=True,
        samesite="lax",
        secure=secure,
    )
    response.set_cookie(
        key=VENDOR_REFRESH_COOKIE_NAME,
        value=session.refresh_token,
        max_age=session.refresh_token_expires_in_seconds,
        path=_REFRESH_COOKIE_PATH,
        httponly=True,
        samesite="lax",
        secure=secure,
    )


def _clear_auth_cookies(response: Response, *, secure: bool) -> None:
    response.delete_cookie(
        key=VENDOR_ACCESS_COOKIE_NAME,
        path=_ACCESS_COOKIE_PATH,
        httponly=True,
        samesite="lax",
        secure=secure,
    )
    response.delete_cookie(
        key=VENDOR_REFRESH_COOKIE_NAME,
        path=_REFRESH_COOKIE_PATH,
        httponly=True,
        samesite="lax",
        secure=secure,
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
    commands: Annotated[VendorAuthCommandPort, Depends(get_vendor_auth_commands)],
) -> VendorAuthSessionResponse:
    """メールアドレスとパスワードで認証し JWT Cookie を発行する。"""
    session = commands.login(to_vendor_login_input(payload))
    _set_auth_cookies(response, session=session, secure=_is_cookie_secure(request))
    return to_vendor_auth_session_response(session)


@router.post(
    "/auth/refresh",
    response_model=VendorAuthSessionResponse,
    responses={
        401: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
    },
    dependencies=[Depends(verify_csrf_origin)],
)
def refresh_vendor_session(
    request: Request,
    response: Response,
    commands: Annotated[VendorAuthCommandPort, Depends(get_vendor_auth_commands)],
) -> VendorAuthSessionResponse:
    """リフレッシュトークンをローテーションし新しい JWT Cookie を発行する。"""
    raw_refresh = request.cookies.get(VENDOR_REFRESH_COOKIE_NAME, "")
    session = commands.refresh(RefreshVendorSessionInput(refresh_token=raw_refresh))
    _set_auth_cookies(response, session=session, secure=_is_cookie_secure(request))
    return to_vendor_auth_session_response(session)


@router.post(
    "/auth/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={403: {"model": ErrorResponse}},
    dependencies=[Depends(verify_csrf_origin)],
)
def logout_vendor_user(
    request: Request,
    commands: Annotated[VendorAuthCommandPort, Depends(get_vendor_auth_commands)],
) -> Response:
    """リフレッシュセッションファミリーを即時失効させ、認証 Cookie を削除する。"""
    raw_refresh = request.cookies.get(VENDOR_REFRESH_COOKIE_NAME)
    commands.logout(LogoutVendorSessionInput(refresh_token=raw_refresh))
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    _clear_auth_cookies(response, secure=_is_cookie_secure(request))
    return response


@router.get(
    "/auth/me",
    response_model=VendorUserResponse,
    responses={401: {"model": ErrorResponse}},
)
def get_current_vendor_user(
    principal: Annotated[VendorAuthPrincipal, Depends(get_current_vendor_principal)],
    queries: Annotated[VendorUserQueryPort, Depends(get_vendor_user_queries)],
) -> VendorUserResponse:
    """現在ログイン中のベンダーユーザー情報を返す。"""
    user = queries.get_current_user(principal.user_id)
    return to_vendor_user_response(user)


@router.get(
    "/users",
    response_model=VendorUserListResponse,
    responses={401: {"model": ErrorResponse}, 403: {"model": ErrorResponse}},
)
def list_vendor_users(
    principal: Annotated[VendorAuthPrincipal, Depends(require_vendor_admin)],
    queries: Annotated[VendorUserQueryPort, Depends(get_vendor_user_queries)],
) -> VendorUserListResponse:
    """管理者権限でベンダーユーザー一覧を返す。"""
    result = queries.list_vendor_users(principal.user_id)
    return to_vendor_user_list_response(result)


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
    principal: Annotated[VendorAuthPrincipal, Depends(require_vendor_admin)],
    commands: Annotated[VendorUserCommandPort, Depends(get_vendor_user_commands)],
) -> VendorUserResponse:
    """管理者権限で新しいベンダー社員アカウントを発行する。"""
    created = commands.create_vendor_user(
        principal.user_id,
        to_create_vendor_user_input(payload),
    )
    return to_vendor_user_response(created)
