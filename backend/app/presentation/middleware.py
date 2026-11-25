"""HTTP リクエストの観測用 ASGI ミドルウェア。"""

import logging
import time
import uuid
from contextvars import ContextVar

from starlette.datastructures import Headers, MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.presentation.error_handlers import REQUEST_ID_HEADER


def _resolve_request_id(headers: Headers) -> str:
    raw = headers.get(REQUEST_ID_HEADER)
    if raw is None:
        return uuid.uuid4().hex
    trimmed = raw.strip()
    if not trimmed or "\r" in trimmed or "\n" in trimmed:
        return uuid.uuid4().hex
    return trimmed


class RequestIdMiddleware:
    """リクエストごとの X-Request-ID を生成・伝播する ASGI ミドルウェア。"""

    def __init__(self, app: ASGIApp, *, request_id_context: ContextVar[str]) -> None:
        self.app = app
        self._request_id_context = request_id_context

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request_id = _resolve_request_id(Headers(scope=scope))
        # ServerErrorMiddleware で捕捉された場合でも同一 ID を参照できるよう state に保持する。
        state = scope.setdefault("state", {})
        if isinstance(state, dict):
            state["request_id"] = request_id

        token = self._request_id_context.set(request_id)

        async def send_with_request_id(message: Message) -> None:
            if message["type"] == "http.response.start":
                MutableHeaders(scope=message)[REQUEST_ID_HEADER] = request_id
            await send(message)

        try:
            await self.app(scope, receive, send_with_request_id)
        finally:
            self._request_id_context.reset(token)


class AccessLogMiddleware:
    """HTTP リクエストごとの構造化アクセスログを出力する ASGI ミドルウェア。"""

    def __init__(self, app: ASGIApp, logger: logging.Logger | None = None) -> None:
        self.app = app
        self.logger = logger or logging.getLogger("app")

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        method = str(scope.get("method", "UNKNOWN"))
        path = str(scope.get("path", "/"))
        status_code = 500
        started_at = time.perf_counter()

        async def send_with_status(message: Message) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = int(message["status"])
            await send(message)

        try:
            await self.app(scope, receive, send_with_status)
        finally:
            duration_ms = round((time.perf_counter() - started_at) * 1000, 2)
            self.logger.info(
                "HTTP リクエストを処理しました",
                extra={
                    "structured_fields": {
                        "method": method,
                        "path": path,
                        "status_code": status_code,
                        "duration_ms": duration_ms,
                    }
                },
            )
