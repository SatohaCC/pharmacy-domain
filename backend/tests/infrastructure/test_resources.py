"""infrastructure/resources の単体テスト。"""

import asyncio

import pytest

from app.infrastructure.resources import ResourceRegistry


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


class _FailingCloseResource:
    def __init__(self, events: list[str], name: str) -> None:
        self._events = events
        self.name = name

    def close(self) -> None:
        self._events.append(f"fail:{self.name}")
        raise RuntimeError(f"close failed: {self.name}")


def test_resource_registry_validates_registration_and_type() -> None:
    registry = ResourceRegistry()
    registry.register("sync", _DummySyncResource([], "sync"))

    with pytest.raises(ValueError, match="空にできません"):
        registry.register(" ", _DummySyncResource([], "blank"))

    with pytest.raises(KeyError, match="既に登録"):
        registry.register("sync", _DummySyncResource([], "dup"))

    with pytest.raises(KeyError, match="登録されていません"):
        registry.require("missing", _DummySyncResource)

    with pytest.raises(TypeError, match="型が一致しません"):
        registry.require("sync", _DummyAsyncResource)


def test_resource_registry_aclose_all_continues_when_one_resource_fails() -> None:
    events: list[str] = []
    registry = ResourceRegistry()
    registry.register("first", _DummySyncResource(events, "first"))
    registry.register("failing", _FailingCloseResource(events, "failing"))
    registry.register("last", _DummyAsyncResource(events, "last"))

    with pytest.raises(RuntimeError, match="close failed: failing"):
        asyncio.run(registry.aclose_all())

    assert events == ["aclose:last", "fail:failing", "close:first"]
    assert "first" not in registry
