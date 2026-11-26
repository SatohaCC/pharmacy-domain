"""lifespan と依存性差し替え（DI）の統合テスト。"""

from datetime import UTC, datetime

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.application.auth.contracts import AuthPrincipal
from app.application.corporate.contracts import (
    CorporationItem,
    CorporationListResult,
    ListCorporationsQuery,
)
from app.infrastructure.config import Settings
from app.infrastructure.resources import ResourceRegistry
from app.main import create_app
from app.presentation.dependencies import get_corporation_queries, get_current_auth_principal


class _DummyAsyncResource:
    def __init__(self, events: list[str], name: str) -> None:
        self._events = events
        self.name = name

    async def aclose(self) -> None:
        self._events.append(f"aclose:{self.name}")


class _DummySyncResource:
    def __init__(self, events: list[str], name: str) -> None:
        self._events = events
        self.name = name

    def close(self) -> None:
        self._events.append(f"close:{self.name}")


def test_lifespan_initializes_and_closes_resources_in_reverse_order() -> None:
    events: list[str] = []

    def startup(_application: FastAPI, registry: ResourceRegistry) -> None:
        events.append("startup")
        registry.register("first", _DummySyncResource(events, "first"))
        registry.register("second", _DummyAsyncResource(events, "second"))

    app = create_app(Settings(database_path=":memory:"), resource_startup=startup)

    with TestClient(app) as client:
        response = client.get("/api/health")
        assert response.status_code == 200
        assert "first" in app.state.resources
        assert app.state.resources.require("second", _DummyAsyncResource).name == "second"

    assert events == ["startup", "aclose:second", "close:first"]
    assert "first" not in app.state.resources


def test_dependency_overrides_can_replace_corporation_use_cases_in_tests() -> None:
    app = create_app(Settings(database_path=":memory:"))

    class _StubUseCases:
        def list_corporations(self, _query: ListCorporationsQuery) -> CorporationListResult:
            now = datetime(2026, 11, 21, 9, 0, tzinfo=UTC)
            return CorporationListResult(
                items=(
                    CorporationItem(
                        id="stub-corp-1",
                        category="corporation",
                        name="モック薬局株式会社",
                        corporate_number="1234567890123",
                        address="東京都千代田区1-1-1",
                        status="active",
                        created_at=now,
                        updated_at=now,
                    ),
                ),
                total=1,
            )

    app.dependency_overrides[get_corporation_queries] = lambda: _StubUseCases()
    app.dependency_overrides[get_current_auth_principal] = lambda: AuthPrincipal(
        user_id="vendor-admin-1",
        email="admin@vendor.example.com",
        display_name="システム管理者",
        scope_type="vendor",
        tenant_id=None,
        roles=("vendor_admin",),
    )

    with TestClient(app) as client:
        response = client.get("/api/corporations")

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 1
    assert payload["items"][0]["id"] == "stub-corp-1"


def test_lifespan_closes_already_registered_resources_when_startup_fails() -> None:
    events: list[str] = []

    def failing_startup(_application: FastAPI, registry: ResourceRegistry) -> None:
        registry.register("first", _DummySyncResource(events, "first"))
        registry.register("second", _DummyAsyncResource(events, "second"))
        raise RuntimeError("startup failed")

    app = create_app(Settings(database_path=":memory:"), resource_startup=failing_startup)

    with pytest.raises(RuntimeError, match="startup failed"), TestClient(app):
        pass

    assert events == ["aclose:second", "close:first"]
    assert "first" not in app.state.resources
