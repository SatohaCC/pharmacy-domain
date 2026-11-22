from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.errors import AppError
from app.main import create_app


def test_health_check_returns_default_service_name() -> None:
    app = create_app(Settings())
    client = TestClient(app)

    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "template-backend",
    }


def test_health_check_uses_injected_settings() -> None:
    app = create_app(Settings(service_name="custom-service"))
    client = TestClient(app)

    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "custom-service",
    }


def test_app_error_handler_returns_structured_error_response() -> None:
    app = create_app(Settings())

    @app.get("/api/test-error")
    def raise_error() -> None:
        raise AppError("対象のリソースが見つかりません", code="NOT_FOUND", status_code=404)

    client = TestClient(app)

    response = client.get("/api/test-error")

    assert response.status_code == 404
    assert response.json() == {
        "code": "NOT_FOUND",
        "detail": "対象のリソースが見つかりません",
    }


def test_validation_error_returns_unified_error_response() -> None:
    app = create_app(Settings())

    @app.get("/api/items/{item_id}")
    def read_item(item_id: int) -> dict[str, int]:
        return {"item_id": item_id}

    client = TestClient(app)

    response = client.get("/api/items/not-an-int")

    assert response.status_code == 422
    payload = response.json()
    assert payload["code"] == "VALIDATION_ERROR"
    assert payload["detail"] == "入力内容に誤りがあります"
    assert isinstance(payload["errors"], list)
    assert payload["errors"][0]["loc"] == ["path", "item_id"]
    assert payload["errors"][0]["type"] == "int_parsing"


def test_http_404_and_405_return_unified_error_response() -> None:
    app = create_app(Settings())
    client = TestClient(app)

    not_found = client.get("/api/unknown-endpoint")
    method_not_allowed = client.post("/api/health")

    assert not_found.status_code == 404
    assert not_found.json() == {"code": "NOT_FOUND", "detail": "Not Found"}

    assert method_not_allowed.status_code == 405
    assert method_not_allowed.json() == {
        "code": "METHOD_NOT_ALLOWED",
        "detail": "Method Not Allowed",
    }
    assert "GET" in method_not_allowed.headers.get("allow", "")


def test_http_exception_without_allowed_body_returns_empty_response() -> None:
    app = create_app(Settings())

    @app.get("/api/test-not-modified")
    def not_modified() -> None:
        raise HTTPException(status_code=304)

    client = TestClient(app)

    response = client.get("/api/test-not-modified")

    assert response.status_code == 304
    assert response.content == b""
