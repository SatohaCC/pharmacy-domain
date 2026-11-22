import inspect
import logging
import time
import uuid
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.utils import is_body_allowed_for_status_code
from starlette.datastructures import Headers, MutableHeaders
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.clients import ClientRegistry, SqliteTaskStore
from app.core.config import Settings, load_settings
from app.core.errors import AppError
from app.core.logging import configure_logging, request_id_context
from app.routers.dependencies import TASK_STORE_CLIENT_NAME
from app.routers.health import router as health_router
from app.routers.tasks import router as tasks_router
from app.schemas.error import ErrorResponse, ValidationErrorDetail

REQUEST_ID_HEADER = "X-Request-ID"

_HTTP_ERROR_CODES: dict[int, str] = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    405: "METHOD_NOT_ALLOWED",
    409: "CONFLICT",
    422: "VALIDATION_ERROR",
    429: "TOO_MANY_REQUESTS",
}

type ClientStartupHook = Callable[[FastAPI, ClientRegistry], Awaitable[None] | None]


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

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request_id = _resolve_request_id(Headers(scope=scope))
        # ServerErrorMiddleware で捕捉された場合でも同一 ID を参照できるよう state に保持する。
        state = scope.setdefault("state", {})
        if isinstance(state, dict):
            state["request_id"] = request_id

        token = request_id_context.set(request_id)

        async def send_with_request_id(message: Message) -> None:
            if message["type"] == "http.response.start":
                MutableHeaders(scope=message)[REQUEST_ID_HEADER] = request_id
            await send(message)

        try:
            await self.app(scope, receive, send_with_request_id)
        finally:
            request_id_context.reset(token)


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


def _format_validation_errors(exc: RequestValidationError) -> list[ValidationErrorDetail]:
    details: list[ValidationErrorDetail] = []
    for err in exc.errors():
        raw_loc = err.get("loc", ())
        loc = [item for item in raw_loc if isinstance(item, str | int)]
        details.append(
            ValidationErrorDetail(
                loc=loc,
                msg=str(err.get("msg", "")),
                type=str(err.get("type", "")),
            )
        )
    return details


def create_app(
    settings: Settings | None = None,
    *,
    client_startup: ClientStartupHook | None = None,
) -> FastAPI:
    """設定を受け取って FastAPI アプリケーションを生成する。"""
    resolved_settings = settings or load_settings()
    logger = configure_logging(resolved_settings.log_level)

    @asynccontextmanager
    async def lifespan(application: FastAPI) -> AsyncIterator[None]:
        registry = getattr(application.state, "clients", None)
        if not isinstance(registry, ClientRegistry):
            registry = ClientRegistry()
            application.state.clients = registry
        try:
            if client_startup is not None:
                maybe_coro = client_startup(application, registry)
                if inspect.isawaitable(maybe_coro):
                    await maybe_coro
            if TASK_STORE_CLIENT_NAME not in registry:
                registry.register(
                    TASK_STORE_CLIENT_NAME,
                    SqliteTaskStore(resolved_settings.database_path),
                )
            yield
        finally:
            await registry.aclose_all()

    application = FastAPI(
        title=resolved_settings.app_name,
        version="0.1.0",
        docs_url="/docs" if resolved_settings.docs_enabled else None,
        redoc_url="/redoc" if resolved_settings.docs_enabled else None,
        openapi_url="/openapi.json" if resolved_settings.docs_enabled else None,
        lifespan=lifespan,
    )
    application.state.settings = resolved_settings
    application.state.clients = ClientRegistry()

    application.add_middleware(
        CORSMiddleware,
        allow_origins=resolved_settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=[REQUEST_ID_HEADER],
    )
    application.add_middleware(AccessLogMiddleware, logger=logger)
    application.add_middleware(RequestIdMiddleware)

    @application.exception_handler(AppError)
    async def handle_app_error(_request: Request, exc: AppError) -> JSONResponse:
        body = ErrorResponse(code=exc.code, detail=exc.message)
        return JSONResponse(
            status_code=exc.status_code,
            content=body.model_dump(exclude_none=True),
        )

    @application.exception_handler(RequestValidationError)
    async def handle_validation_error(
        _request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        body = ErrorResponse(
            code="VALIDATION_ERROR",
            detail="入力内容に誤りがあります",
            errors=_format_validation_errors(exc),
        )
        return JSONResponse(
            status_code=422,
            content=body.model_dump(exclude_none=True),
        )

    @application.exception_handler(StarletteHTTPException)
    async def handle_http_error(_request: Request, exc: StarletteHTTPException) -> Response:
        if not is_body_allowed_for_status_code(exc.status_code):
            return Response(status_code=exc.status_code, headers=exc.headers)
        code = _HTTP_ERROR_CODES.get(exc.status_code, f"HTTP_{exc.status_code}")
        detail = exc.detail if isinstance(exc.detail, str) else "リクエストを処理できませんでした"
        body = ErrorResponse(code=code, detail=detail)
        return JSONResponse(
            status_code=exc.status_code,
            content=body.model_dump(exclude_none=True),
            headers=exc.headers,
        )

    @application.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, _exc: Exception) -> JSONResponse:
        request_id = getattr(request.state, "request_id", None)
        if not isinstance(request_id, str) or not request_id:
            request_id = request_id_context.get()
        token = request_id_context.set(request_id)
        try:
            logger.exception("未処理の例外が発生しました")
        finally:
            request_id_context.reset(token)
        body = ErrorResponse(
            code="INTERNAL_SERVER_ERROR",
            detail="サーバー内部でエラーが発生しました",
        )
        return JSONResponse(
            status_code=500,
            content=body.model_dump(exclude_none=True),
            headers={REQUEST_ID_HEADER: request_id},
        )

    application.include_router(health_router)
    application.include_router(tasks_router)
    return application


app = create_app()
