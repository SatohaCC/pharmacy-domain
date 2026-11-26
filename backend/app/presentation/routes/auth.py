"""共通認証 API ルーター（ログイン・リフレッシュ・ログアウト・自身情報取得）。"""

from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response, status

from app.application.auth.contracts import (
    AuthCommandPort,
    AuthPrincipal,
    AuthSessionView,
    AuthUserQueryPort,
    LogoutAuthSessionInput,
    RefreshAuthSessionInput,
)
from app.presentation.dependencies import (
    AUTH_ACCESS_COOKIE_NAME,
    AUTH_REFRESH_COOKIE_NAME,
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

_ACCESS_COOKIE_PATH = "/api"
_REFRESH_COOKIE_PATH = "/api/auth"


def _is_cookie_secure(request: Request) -> bool:
    settings = getattr(request.app.state, "settings", None)
    return bool(getattr(settings, "auth_cookie_secure", False))


def _set_auth_cookies(
    response: Response,
    *,
    session: AuthSessionView,
    secure: bool,
) -> None:
    response.set_cookie(
        key=AUTH_ACCESS_COOKIE_NAME,
        value=session.access_token,
        max_age=session.access_token_expires_in_seconds,
        path=_ACCESS_COOKIE_PATH,
        httponly=True,
        samesite="lax",
        secure=secure,
    )
    response.set_cookie(
        key=AUTH_REFRESH_COOKIE_NAME,
        value=session.refresh_token,
        max_age=session.refresh_token_expires_in_seconds,
        path=_REFRESH_COOKIE_PATH,
        httponly=True,
        samesite="lax",
        secure=secure,
    )


def _clear_auth_cookies(response: Response, *, secure: bool) -> None:
    response.delete_cookie(
        key=AUTH_ACCESS_COOKIE_NAME,
        path=_ACCESS_COOKIE_PATH,
        httponly=True,
        samesite="lax",
        secure=secure,
    )
    response.delete_cookie(
        key=AUTH_REFRESH_COOKIE_NAME,
        path=_REFRESH_COOKIE_PATH,
        httponly=True,
        samesite="lax",
        secure=secure,
    )


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
    _set_auth_cookies(response, session=session, secure=_is_cookie_secure(request))
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
    _set_auth_cookies(response, session=session, secure=_is_cookie_secure(request))
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
    raw_refresh = request.cookies.get(AUTH_REFRESH_COOKIE_NAME)
    commands.logout(LogoutAuthSessionInput(refresh_token=raw_refresh))
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    _clear_auth_cookies(response, secure=_is_cookie_secure(request))
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
