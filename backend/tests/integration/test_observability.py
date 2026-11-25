"""可観測性・ミドルウェア・設定反映の統合テスト。"""

import io
import json
import logging

import pytest
from fastapi.testclient import TestClient

from app.infrastructure.config import Settings
from app.infrastructure.logging import JsonLogFormatter, request_id_context
from app.main import create_app
from app.presentation.error_handlers import REQUEST_ID_HEADER


def test_request_id_is_generated_when_header_is_missing() -> None:
    app = create_app(Settings())
    client = TestClient(app)

    response = client.get("/api/health")

    assert response.status_code == 200
    request_id = response.headers.get(REQUEST_ID_HEADER)
    assert request_id is not None
    assert len(request_id) > 0


def test_request_id_is_propagated_from_request_header() -> None:
    app = create_app(Settings())
    client = TestClient(app)

    response = client.get("/api/health", headers={REQUEST_ID_HEADER: "req-123"})

    assert response.status_code == 200
    assert response.headers.get_list(REQUEST_ID_HEADER) == ["req-123"]
    assert request_id_context.get() == "-"


def test_invalid_or_blank_request_id_header_is_replaced_with_generated_id() -> None:
    app = create_app(Settings())
    client = TestClient(app)

    blank_response = client.get("/api/health", headers={REQUEST_ID_HEADER: "   "})
    newline_response = client.get("/api/health", headers={REQUEST_ID_HEADER: "bad\nvalue"})

    for resp in (blank_response, newline_response):
        assert resp.status_code == 200
        generated = resp.headers.get(REQUEST_ID_HEADER)
        assert generated is not None
        assert len(generated) == 32
        assert generated != "bad\nvalue"


def test_cors_exposes_request_id_header() -> None:
    app = create_app(Settings(cors_origins=["http://localhost:3000"]))
    client = TestClient(app)

    response = client.get("/api/health", headers={"Origin": "http://localhost:3000"})

    assert response.status_code == 200
    assert REQUEST_ID_HEADER in response.headers.get("access-control-expose-headers", "")


def test_docs_endpoints_can_be_disabled_via_settings() -> None:
    app = create_app(Settings(docs_enabled=False))
    client = TestClient(app)

    assert client.get("/docs").status_code == 404
    assert client.get("/redoc").status_code == 404
    assert client.get("/openapi.json").status_code == 404
    # openapi.json の公開を無効化しても、型生成で使う openapi() 辞書自体は生成できることを確認する。
    assert "/api/health" in app.openapi()["paths"]


def test_create_app_uses_explicit_settings_over_environment(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DOCS_ENABLED", "false")
    monkeypatch.setenv("DATABASE_PATH", "configured.db")
    settings = Settings(docs_enabled=True)

    application = create_app(settings)

    assert application.state.settings is settings
    assert application.openapi_url == "/openapi.json"
    assert application.state.settings.database_path == "data/app.db"


def test_access_log_includes_request_id_status_and_duration() -> None:
    app = create_app(Settings(log_level="INFO"))

    stream = io.StringIO()
    logger = logging.getLogger("app")
    stream_handler = logging.StreamHandler(stream)
    stream_handler.setFormatter(JsonLogFormatter())
    logger.addHandler(stream_handler)

    try:
        client = TestClient(app)
        response = client.get("/api/health", headers={REQUEST_ID_HEADER: "req-access-1"})
    finally:
        logger.removeHandler(stream_handler)

    assert response.status_code == 200
    entries = [json.loads(line) for line in stream.getvalue().strip().splitlines()]
    access_entry = entries[-1]
    assert access_entry["level"] == "INFO"
    assert access_entry["request_id"] == "req-access-1"
    assert access_entry["message"] == "HTTP リクエストを処理しました"
    assert access_entry["method"] == "GET"
    assert access_entry["path"] == "/api/health"
    assert access_entry["status_code"] == 200
    assert isinstance(access_entry["duration_ms"], float)


def test_unhandled_exception_returns_500_error_response_with_request_id_and_json_log() -> None:
    app = create_app(Settings())

    @app.get("/api/test-unhandled-error")
    def raise_unexpected_error() -> None:
        raise RuntimeError("予期しない不具合")

    stream = io.StringIO()
    logger = logging.getLogger("app")
    stream_handler = logging.StreamHandler(stream)
    stream_handler.setFormatter(JsonLogFormatter())
    logger.addHandler(stream_handler)

    try:
        client = TestClient(app, raise_server_exceptions=False)
        response = client.get(
            "/api/test-unhandled-error",
            headers={REQUEST_ID_HEADER: "req-500-trace"},
        )
    finally:
        logger.removeHandler(stream_handler)

    assert response.status_code == 500
    assert response.headers.get_list(REQUEST_ID_HEADER) == ["req-500-trace"]
    assert response.json() == {
        "code": "INTERNAL_SERVER_ERROR",
        "detail": "サーバー内部の一時的な問題により処理を完了できませんでした。",
        "title": "処理を完了できませんでした",
        "reassurance": "処理結果が確定できていない可能性があります。最新の状態をご確認ください。",
        "reason": "サーバー内部の一時的な問題により処理を完了できませんでした。",
        "how_to_fix": "しばらく時間をおいてから、最新の状態を確認のうえ再度お試しください。",
        "way_out": "問題が繰り返し発生する場合は、サポート窓口へお問い合わせください。",
        "actions": [
            {"label": "再試行", "action_type": "retry"},
            {"label": "サポートへ問い合わせ", "action_type": "contact_support"},
        ],
    }

    log_entry = json.loads(stream.getvalue().strip().splitlines()[-1])
    assert log_entry["level"] == "ERROR"
    assert log_entry["request_id"] == "req-500-trace"
    assert log_entry["message"] == "未処理の例外が発生しました"
    assert "RuntimeError" in log_entry["exception"]
