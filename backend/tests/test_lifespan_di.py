import asyncio
from typing import Annotated

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.clients import ClientRegistry
from app.core.config import Settings
from app.main import create_app
from app.routers.dependencies import get_client_registry


class _DummyAsyncClient:
    def __init__(self, events: list[str], name: str) -> None:
        self._events = events
        self.name = name

    async def aclose(self) -> None:
        self._events.append(f"aclose:{self.name}")


class _DummySyncClient:
    def __init__(self, events: list[str], name: str) -> None:
        self._events = events
        self.name = name

    def close(self) -> None:
        self._events.append(f"close:{self.name}")


class _FailingCloseClient:
    def __init__(self, events: list[str], name: str) -> None:
        self._events = events
        self.name = name

    def close(self) -> None:
        self._events.append(f"fail:{self.name}")
        raise RuntimeError(f"close failed: {self.name}")


def test_lifespan_initializes_and_closes_clients_in_reverse_order() -> None:
    events: list[str] = []

    def startup(_application: FastAPI, registry: ClientRegistry) -> None:
        events.append("startup")
        registry.register("first", _DummySyncClient(events, "first"))
        registry.register("second", _DummyAsyncClient(events, "second"))

    app = create_app(Settings(), client_startup=startup)

    @app.get("/api/test-client")
    def read_client(
        registry: Annotated[ClientRegistry, Depends(get_client_registry)],
    ) -> dict[str, str]:
        client = registry.require("second", _DummyAsyncClient)
        return {"client": client.name}

    with TestClient(app) as client:
        response = client.get("/api/test-client")
        assert response.status_code == 200
        assert response.json() == {"client": "second"}
        assert "first" in app.state.clients

    assert events == ["startup", "aclose:second", "close:first"]
    assert "first" not in app.state.clients


def test_dependency_overrides_can_replace_client_registry_in_tests() -> None:
    app = create_app(Settings())

    @app.get("/api/test-override")
    def read_client(
        registry: Annotated[ClientRegistry, Depends(get_client_registry)],
    ) -> dict[str, str]:
        client = registry.require("search", _DummySyncClient)
        return {"client": client.name}

    stub_registry = ClientRegistry()
    stub_registry.register("search", _DummySyncClient([], "mock-search"))
    app.dependency_overrides[get_client_registry] = lambda: stub_registry

    with TestClient(app) as client:
        response = client.get("/api/test-override")

    assert response.status_code == 200
    assert response.json() == {"client": "mock-search"}


def test_client_registry_validates_registration_and_type() -> None:
    registry = ClientRegistry()
    registry.register("sync", _DummySyncClient([], "sync"))

    with pytest.raises(ValueError, match="空にできません"):
        registry.register(" ", _DummySyncClient([], "blank"))

    with pytest.raises(KeyError, match="既に登録"):
        registry.register("sync", _DummySyncClient([], "dup"))

    with pytest.raises(KeyError, match="登録されていません"):
        registry.require("missing", _DummySyncClient)

    with pytest.raises(TypeError, match="型が一致しません"):
        registry.require("sync", _DummyAsyncClient)


def test_client_registry_aclose_all_continues_when_one_client_fails() -> None:
    events: list[str] = []
    registry = ClientRegistry()
    registry.register("first", _DummySyncClient(events, "first"))
    registry.register("failing", _FailingCloseClient(events, "failing"))
    registry.register("last", _DummyAsyncClient(events, "last"))

    with pytest.raises(RuntimeError, match="close failed: failing"):
        asyncio.run(registry.aclose_all())

    assert events == ["aclose:last", "fail:failing", "close:first"]
    assert "first" not in registry


def test_lifespan_closes_already_registered_clients_when_startup_fails() -> None:
    events: list[str] = []

    def failing_startup(_application: FastAPI, registry: ClientRegistry) -> None:
        registry.register("first", _DummySyncClient(events, "first"))
        registry.register("second", _DummyAsyncClient(events, "second"))
        raise RuntimeError("startup failed")

    app = create_app(Settings(), client_startup=failing_startup)

    with pytest.raises(RuntimeError, match="startup failed"), TestClient(app):
        pass

    assert events == ["aclose:second", "close:first"]
    assert "first" not in app.state.clients
