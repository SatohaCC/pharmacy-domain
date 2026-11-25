"""ヘルスチェック API の統合テスト。"""

from fastapi.testclient import TestClient

from app.infrastructure.config import Settings
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
