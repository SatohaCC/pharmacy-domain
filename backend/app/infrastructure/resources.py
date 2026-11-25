"""共有技術資源のライフサイクル管理。"""

import inspect
from collections.abc import Awaitable, Callable
from typing import TypeVar

T = TypeVar("T")


async def _close_resource(resource: object) -> None:
    aclose = getattr(resource, "aclose", None)
    if callable(aclose):
        result = aclose()
        if inspect.isawaitable(result):
            await result
        return

    close = getattr(resource, "close", None)
    if callable(close):
        close()
        return

    dispose = getattr(resource, "dispose", None)
    if callable(dispose):
        dispose()


class ResourceRegistry:
    """アプリ起動時に登録された共有資源を逆順に確実に解放するレジストリ。"""

    def __init__(self) -> None:
        self._resources: dict[str, object] = {}

    def register(self, name: str, resource: object) -> None:
        """名前付きで資源を登録する。"""
        if not name.strip():
            raise ValueError("資源名は空にできません。")
        if name in self._resources:
            raise KeyError(f"資源は既に登録されています: {name}")
        self._resources[name] = resource

    def require(self, name: str, expected_type: type[T]) -> T:
        """登録済みの資源を型検査付きで取得する。"""
        if name not in self._resources:
            raise KeyError(f"資源が登録されていません: {name}")
        resource = self._resources[name]
        if not isinstance(resource, expected_type):
            raise TypeError(f"資源の型が一致しません: {name} (expected {expected_type.__name__})")
        return resource

    def __contains__(self, name: str) -> bool:
        return name in self._resources

    async def aclose_all(self) -> None:
        """登録済み資源を逆順にすべて解放する。失敗しても残りの解放を継続する。"""
        items = list(reversed(self._resources.items()))
        self._resources.clear()

        first_error: BaseException | None = None
        for _name, resource in items:
            try:
                await _close_resource(resource)
            except BaseException as exc:
                if first_error is None:
                    first_error = exc
        if first_error is not None:
            raise first_error


type ResourceStartupHook = Callable[[object, ResourceRegistry], Awaitable[None] | None]
