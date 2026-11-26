"""共通認証 API と旧ベンダー認証 API の Cookie を管理する。"""

from fastapi import Request, Response

from app.application.auth.contracts import AuthSessionView
from app.presentation.dependencies import (
    AUTH_ACCESS_COOKIE_NAME,
    AUTH_REFRESH_COOKIE_NAME,
    VENDOR_ACCESS_COOKIE_NAME,
    VENDOR_REFRESH_COOKIE_NAME,
)

_AUTH_ACCESS_COOKIE = (AUTH_ACCESS_COOKIE_NAME, "/api")
_AUTH_REFRESH_COOKIE = (AUTH_REFRESH_COOKIE_NAME, "/api/auth")
_VENDOR_ACCESS_COOKIE = (VENDOR_ACCESS_COOKIE_NAME, "/api")
_VENDOR_REFRESH_COOKIE = (VENDOR_REFRESH_COOKIE_NAME, "/api/vendor/auth")
_VENDOR_COOKIES = (_VENDOR_ACCESS_COOKIE, _VENDOR_REFRESH_COOKIE)


def _is_cookie_secure(request: Request) -> bool:
    settings = getattr(request.app.state, "settings", None)
    return bool(getattr(settings, "auth_cookie_secure", False))


def _clear_cookies(
    response: Response, cookies: tuple[tuple[str, str], ...], *, secure: bool
) -> None:
    for key, path in cookies:
        response.delete_cookie(key=key, path=path, httponly=True, samesite="lax", secure=secure)


def set_auth_cookies(request: Request, response: Response, session: AuthSessionView) -> None:
    """ベンダーセッションは両 API の Cookie に同じトークンを発行する。"""
    secure = _is_cookie_secure(request)
    cookies: tuple[tuple[str, str, str, int], ...] = (
        (*_AUTH_ACCESS_COOKIE, session.access_token, session.access_token_expires_in_seconds),
        (*_AUTH_REFRESH_COOKIE, session.refresh_token, session.refresh_token_expires_in_seconds),
    )
    if session.user.affiliation_type == "vendor":
        cookies += (
            (*_VENDOR_ACCESS_COOKIE, session.access_token, session.access_token_expires_in_seconds),
            (
                *_VENDOR_REFRESH_COOKIE,
                session.refresh_token,
                session.refresh_token_expires_in_seconds,
            ),
        )
    else:
        _clear_cookies(response, _VENDOR_COOKIES, secure=secure)

    for key, path, token, max_age in cookies:
        response.set_cookie(
            key=key,
            value=token,
            max_age=max_age,
            path=path,
            httponly=True,
            samesite="lax",
            secure=secure,
        )


def clear_auth_cookies(request: Request, response: Response) -> None:
    """共通認証と旧ベンダー認証の Cookie を発行時の Path で削除する。"""
    _clear_cookies(
        response,
        (_AUTH_ACCESS_COOKIE, _AUTH_REFRESH_COOKIE, *_VENDOR_COOKIES),
        secure=_is_cookie_secure(request),
    )
