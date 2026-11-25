import io
import json
import logging
import os

import pytest
from fastapi.testclient import TestClient

from app.infrastructure.config import Settings, load_settings
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


def test_load_settings_parses_existing_environment_formats(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CORS_ORIGINS", "https://one.example, , https://two.example ")
    monkeypatch.setenv("DOCS_ENABLED", " Off ")
    monkeypatch.setenv("LOG_LEVEL", " debug ")
    monkeypatch.setenv("DATABASE_PATH", " :memory: ")

    loaded = load_settings()

    assert loaded.cors_origins == ["https://one.example", "https://two.example"]
    assert loaded.docs_enabled is False
    assert loaded.log_level == "DEBUG"
    assert loaded.database_path == ":memory:"


@pytest.mark.parametrize("empty_value", [None, ""])
def test_load_settings_uses_defaults(
    monkeypatch: pytest.MonkeyPatch, empty_value: str | None
) -> None:
    for key in ("CORS_ORIGINS", "DOCS_ENABLED", "LOG_LEVEL", "DATABASE_PATH"):
        if empty_value is None:
            monkeypatch.delenv(key, raising=False)
        else:
            monkeypatch.setenv(key, empty_value)

    loaded = load_settings()

    assert loaded.cors_origins == ["http://localhost:3000", "http://127.0.0.1:3000"]
    assert loaded.docs_enabled is True
    assert loaded.log_level == "INFO"
    assert loaded.database_path == "data/app.db"


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


def test_load_settings_reads_only_supported_environment_fields(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("APP_NAME", "Ignored API name")
    monkeypatch.setenv("SERVICE_NAME", "ignored-service")

    loaded = load_settings()

    assert loaded.app_name == "Template API"
    assert loaded.service_name == "template-backend"


def test_load_settings_preserves_case_sensitive_environment_lookup(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        os,
        "environ",
        {"DOCS_ENABLED": "false", "docs_enabled": "true", "database_path": "ignored.db"},
    )

    loaded = load_settings()

    assert loaded.docs_enabled is False
    assert loaded.database_path == "data/app.db"


def test_load_settings_rejects_invalid_values(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DOCS_ENABLED", "invalid-bool")
    with pytest.raises(ValueError, match="不正な真偽値設定です"):
        load_settings()

    monkeypatch.delenv("DOCS_ENABLED")
    monkeypatch.setenv("LOG_LEVEL", "VERBOSE")
    with pytest.raises(ValueError, match="不正なログレベル設定です"):
        load_settings()


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


def test_json_log_formatter_outputs_structured_payload() -> None:
    formatter = JsonLogFormatter()
    record = logging.LogRecord(
        name="app.test",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg="hello %s",
        args=("world",),
        exc_info=None,
    )
    token = request_id_context.set("req-log-1")
    try:
        formatted = formatter.format(record)
    finally:
        request_id_context.reset(token)

    payload = json.loads(formatted)
    assert set(payload.keys()) == {"timestamp", "level", "logger", "request_id", "message"}
    assert payload["level"] == "INFO"
    assert payload["logger"] == "app.test"
    assert payload["request_id"] == "req-log-1"
    assert payload["message"] == "hello world"
