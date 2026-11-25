"""presentation/error_handlers の単体・ハンドラテスト。"""

import io
import json
import logging
from contextvars import ContextVar

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from pydantic import BaseModel

from app.application.foundation.errors import (
    ApplicationAuthorizationError,
    ApplicationBadRequestError,
    ApplicationConflictError,
)
from app.presentation.error_handlers import REQUEST_ID_HEADER, register_exception_handlers


def test_register_exception_handlers_integrates_all_error_paths() -> None:
    app = FastAPI()
    request_id_context: ContextVar[str] = ContextVar("test_request_id", default="req-fallback")
    stream = io.StringIO()
    logger = logging.getLogger("test.error_handlers")
    logger.setLevel(logging.INFO)
    handler = logging.StreamHandler(stream)
    logger.addHandler(handler)
    register_exception_handlers(app, logger=logger, request_id_context=request_id_context)

    class _Payload(BaseModel):
        count: int

    @app.post("/items")
    def create_item(payload: _Payload) -> dict[str, int]:
        return {"count": payload.count}

    @app.get("/app-bad-request")
    def raise_bad_request() -> None:
        raise ApplicationBadRequestError("更新項目を指定してください。", code="EMPTY_UPDATE")

    @app.get("/app-conflict")
    def raise_conflict() -> None:
        raise ApplicationConflictError(
            "他の操作と競合しました。",
            code="CORPORATION_CONFLICT",
            state_impact="unchanged",
        )

    @app.get("/app-idor")
    def raise_idor() -> None:
        raise ApplicationAuthorizationError(
            "別テナントのリソースです。",
            code="TENANT_FORBIDDEN",
            details={"secret_hint": "exists"},
            conceal_as_not_found=True,
        )

    @app.get("/http-503")
    def raise_http_503() -> None:
        raise HTTPException(status_code=503, detail="internal-secret-dsn")

    @app.get("/http-204", status_code=204)
    def raise_http_204() -> None:
        raise HTTPException(status_code=204)

    @app.get("/unexpected")
    def raise_unexpected() -> None:
        raise RuntimeError("sqlite3.OperationalError: /secret/path/app.db")

    try:
        client = TestClient(app, raise_server_exceptions=False)

        # 422 RequestValidationError: 生入力値が msg に含まれないこと。
        res_422 = client.post("/items", json={"count": "SECRET_RAW_INPUT"})
        assert res_422.status_code == 422
        body_422 = res_422.json()
        assert body_422["code"] == "VALIDATION_ERROR"
        assert "SECRET_RAW_INPUT" not in json.dumps(body_422, ensure_ascii=False)
        assert body_422["errors"] == [
            {"loc": ["body", "count"], "msg": "整数で入力してください。", "type": "int_parsing"}
        ]
        assert body_422["title"] == "入力内容を確認してください"

        # 400 ApplicationBadRequestError
        res_400 = client.get("/app-bad-request")
        assert res_400.status_code == 400
        assert res_400.json()["code"] == "EMPTY_UPDATE"
        assert res_400.json()["detail"] == "更新項目を指定してください。"

        # 409 ApplicationConflictError
        res_409 = client.get("/app-conflict")
        assert res_409.status_code == 409
        assert res_409.json()["reassurance"] == "既存のデータは変更されていません。"
        assert [a["action_type"] for a in res_409.json()["actions"]] == ["reload", "cancel"]

        # 403 -> 404 IDOR 秘匿
        res_idor = client.get("/app-idor")
        assert res_idor.status_code == 404
        assert res_idor.json()["code"] == "NOT_FOUND"
        assert "details" not in res_idor.json()
        assert "別テナント" not in res_idor.json()["reason"]

        # 503 HTTPException サニタイズ
        res_503 = client.get("/http-503")
        assert res_503.status_code == 503
        assert "internal-secret-dsn" not in json.dumps(res_503.json(), ensure_ascii=False)

        # 204 HTTPException（ボディなし）
        res_204 = client.get("/http-204")
        assert res_204.status_code == 204
        assert res_204.text == ""

        # 500 未処理例外サニタイズ + X-Request-ID
        res_500 = client.get("/unexpected")
        assert res_500.status_code == 500
        assert res_500.headers[REQUEST_ID_HEADER] == "req-fallback"
        body_500 = res_500.json()
        assert body_500["code"] == "INTERNAL_SERVER_ERROR"
        assert "/secret/path" not in json.dumps(body_500, ensure_ascii=False)
        assert "未処理の例外が発生しました" in stream.getvalue()
    finally:
        logger.removeHandler(handler)


def test_unexpected_error_without_default_request_id_context_falls_back_to_dash() -> None:
    app = FastAPI()
    no_default_context: ContextVar[str] = ContextVar("test_request_id_no_default")
    stream = io.StringIO()
    logger = logging.getLogger("test.error_handlers.no_default")
    logger.setLevel(logging.INFO)
    handler = logging.StreamHandler(stream)
    logger.addHandler(handler)
    register_exception_handlers(app, logger=logger, request_id_context=no_default_context)

    @app.get("/unexpected-no-default")
    def raise_unexpected() -> None:
        raise RuntimeError("boom")

    try:
        client = TestClient(app, raise_server_exceptions=False)
        res = client.get("/unexpected-no-default")
        assert res.status_code == 500
        assert res.headers[REQUEST_ID_HEADER] == "-"
        assert res.json()["code"] == "INTERNAL_SERVER_ERROR"
    finally:
        logger.removeHandler(handler)
