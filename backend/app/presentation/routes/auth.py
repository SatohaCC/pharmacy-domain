"""共通認証 API ルーター（ログイン・リフレッシュ・ログアウト・自身情報取得）。"""

from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response, status

from app.application.auth.contracts import (
    AuthCommandPort,
    AuthPrincipal,
    AuthUserQueryPort,
    LogoutAuthSessionInput,
    RefreshAuthSessionInput,
)
from app.presentation.auth_cookies import clear_auth_cookies, set_auth_cookies
from app.presentation.dependencies import (
    AUTH_REFRESH_COOKIE_NAME,
    VENDOR_REFRESH_COOKIE_NAME,
    get_auth_commands,
    get_auth_user_queries,
    get_current_auth_principal,
    verify_csrf_origin,
)
from app.presentation.dto.auth import (
    AuthLoginRequest,
    AuthSessionResponse,
    AuthUserResponse,
)
from app.presentation.dto.error import ErrorResponse
from app.presentation.mappers.auth import (
    to_auth_login_input,
    to_auth_session_response,
    to_auth_user_response,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post(
    "/login",
    response_model=AuthSessionResponse,
    responses={401: {"model": ErrorResponse}, 422: {"model": ErrorResponse}},
)
def login_auth(
    payload: AuthLoginRequest,
    request: Request,
    response: Response,
    commands: Annotated[AuthCommandPort, Depends(get_auth_commands)],
) -> AuthSessionResponse:
    """メールアドレスとパスワードで認証し JWT Cookie を発行する。"""
    session = commands.login(to_auth_login_input(payload))
    set_auth_cookies(request, response, session)
    return to_auth_session_response(session)


@router.post(
    "/refresh",
    response_model=AuthSessionResponse,
    responses={
        401: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
    },
    dependencies=[Depends(verify_csrf_origin)],
)
def refresh_auth_session(
    request: Request,
    response: Response,
    commands: Annotated[AuthCommandPort, Depends(get_auth_commands)],
) -> AuthSessionResponse:
    """リフレッシュトークンをローテーションし新しい JWT Cookie を発行する。"""
    raw_refresh = request.cookies.get(AUTH_REFRESH_COOKIE_NAME, "")
    session = commands.refresh(RefreshAuthSessionInput(refresh_token=raw_refresh))
    set_auth_cookies(request, response, session)
    return to_auth_session_response(session)


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={403: {"model": ErrorResponse}},
    dependencies=[Depends(verify_csrf_origin)],
)
def logout_auth(
    request: Request,
    commands: Annotated[AuthCommandPort, Depends(get_auth_commands)],
) -> Response:
    """リフレッシュセッションファミリーを即時失効させ、認証 Cookie を削除する。"""
    raw_refresh = request.cookies.get(AUTH_REFRESH_COOKIE_NAME) or request.cookies.get(
        VENDOR_REFRESH_COOKIE_NAME
    )
    commands.logout(LogoutAuthSessionInput(refresh_token=raw_refresh))
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    clear_auth_cookies(request, response)
    return response


@router.get(
    "/me",
    response_model=AuthUserResponse,
    responses={401: {"model": ErrorResponse}},
)
def get_current_auth_user(
    principal: Annotated[AuthPrincipal, Depends(get_current_auth_principal)],
    queries: Annotated[AuthUserQueryPort, Depends(get_auth_user_queries)],
) -> AuthUserResponse:
    """現在ログイン中のユーザー情報と有効ロール一覧を返す。"""
    user = queries.get_current_user(principal.user_id)
    return to_auth_user_response(user)
