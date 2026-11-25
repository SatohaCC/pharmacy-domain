"""アプリケーション例外および HTTP 例外から公開エラーレスポンスへの変換。"""

import logging
from contextvars import ContextVar

from fastapi import FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.utils import is_body_allowed_for_status_code
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.application.foundation.errors import ApplicationError
from app.presentation.dto.error import ValidationErrorDetail
from app.presentation.error_presenter import (
    present_application_error,
    present_http_error,
    present_request_validation_error,
    present_unexpected_error,
)

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

_SAFE_VALIDATION_MESSAGES: dict[str, str] = {
    "missing": "必須項目が入力されていません。",
    "string_type": "文字列で入力してください。",
    "int_parsing": "整数で入力してください。",
    "int_type": "整数で入力してください。",
    "float_parsing": "数値で入力してください。",
    "float_type": "数値で入力してください。",
    "bool_parsing": "真偽値で入力してください。",
    "bool_type": "真偽値で入力してください。",
    "extra_forbidden": "許可されていない項目が含まれています。",
    "json_invalid": "JSON の形式が正しくありません。",
    "string_too_short": "文字数が不足しています。",
    "string_too_long": "文字数が上限を超えています。",
    "string_pattern_mismatch": "入力形式が正しくありません。",
    "enum": "許可された選択肢から指定してください。",
    "literal_error": "許可された値から指定してください。",
    "value_error": "入力値が不正です。",
}


def _format_validation_errors(exc: RequestValidationError) -> list[ValidationErrorDetail]:
    """Pydantic の検証エラーから生入力値を除いた安全な詳細リストを生成する。"""
    details: list[ValidationErrorDetail] = []
    for err in exc.errors():
        raw_loc = err.get("loc", ())
        loc = [item for item in raw_loc if isinstance(item, str | int)]
        error_type = str(err.get("type", ""))
        safe_msg = _SAFE_VALIDATION_MESSAGES.get(error_type, "入力形式が正しくありません。")
        details.append(
            ValidationErrorDetail(
                loc=loc,
                msg=safe_msg,
                type=error_type,
            )
        )
    return details


def register_exception_handlers(
    application: FastAPI,
    *,
    logger: logging.Logger,
    request_id_context: ContextVar[str],
) -> None:
    """FastAPI アプリケーションへ公開エラー変換ハンドラを登録する。"""

    @application.exception_handler(ApplicationError)
    async def handle_application_error(_request: Request, exc: ApplicationError) -> JSONResponse:
        status_code, body = present_application_error(exc)
        return JSONResponse(
            status_code=status_code,
            content=body.model_dump(exclude_none=True),
        )

    @application.exception_handler(RequestValidationError)
    async def handle_validation_error(
        _request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        body = present_request_validation_error(_format_validation_errors(exc))
        return JSONResponse(
            status_code=422,
            content=body.model_dump(exclude_none=True),
        )

    @application.exception_handler(StarletteHTTPException)
    async def handle_http_error(_request: Request, exc: StarletteHTTPException) -> Response:
        if not is_body_allowed_for_status_code(exc.status_code):
            return Response(status_code=exc.status_code, headers=exc.headers)
        code = _HTTP_ERROR_CODES.get(exc.status_code, f"HTTP_{exc.status_code}")
        raw_detail = exc.detail if isinstance(exc.detail, str) else None
        body = present_http_error(exc.status_code, code=code, detail=raw_detail)
        return JSONResponse(
            status_code=exc.status_code,
            content=body.model_dump(exclude_none=True),
            headers=exc.headers,
        )

    @application.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, _exc: Exception) -> JSONResponse:
        request_id = getattr(request.state, "request_id", None)
        if not isinstance(request_id, str) or not request_id:
            try:
                request_id = request_id_context.get()
            except LookupError:
                request_id = "-"
        token = request_id_context.set(request_id)
        try:
            logger.exception("未処理の例外が発生しました")
        finally:
            request_id_context.reset(token)
        body = present_unexpected_error()
        return JSONResponse(
            status_code=500,
            content=body.model_dump(exclude_none=True),
            headers={REQUEST_ID_HEADER: request_id},
        )
