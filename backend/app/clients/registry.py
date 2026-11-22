import inspect
from typing import Protocol, TypeVar, runtime_checkable

T = TypeVar("T")


@runtime_checkable
class AsyncCloseable(Protocol):
    """非同期クローズメソッドを持つ外部クライアントのプロトコル。"""

    async def aclose(self) -> object: ...


@runtime_checkable
class SyncCloseable(Protocol):
    """同期クローズメソッドを持つ外部クライアントのプロトコル。"""

    def close(self) -> object: ...


async def _close_client(client: object) -> None:
    if isinstance(client, AsyncCloseable):
        async_result = client.aclose()
        if inspect.isawaitable(async_result):
            await async_result
        return
    if isinstance(client, SyncCloseable):
        sync_result = client.close()
        if inspect.isawaitable(sync_result):
            await sync_result


class ClientRegistry:
    """外部クライアントを名前付きで保持し、終了時に逆順でクリーンアップするレジストリ。"""

    def __init__(self) -> None:
        self._clients: dict[str, object] = {}
        self._order: list[str] = []

    def register(self, name: str, client: T, *, overwrite: bool = False) -> T:
        """クライアントを登録して返す。"""
        if not name or not name.strip():
            raise ValueError("クライアント名は空にできません。")
        if name in self._clients:
            if not overwrite:
                raise KeyError(f"クライアント '{name}' は既に登録されています。")
            self._order = [existing for existing in self._order if existing != name]
        self._clients[name] = client
        self._order.append(name)
        return client

    def get(self, name: str) -> object | None:
        """登録済みクライアントを取得する。未登録の場合は None を返す。"""
        return self._clients.get(name)

    def require(self, name: str, expected_type: type[T]) -> T:
        """登録済みクライアントを型検証付きで取得する。"""
        if name not in self._clients:
            raise KeyError(f"クライアント '{name}' は登録されていません。")
        client = self._clients[name]
        if not isinstance(client, expected_type):
            raise TypeError(
                f"クライアント '{name}' の型が一致しません: "
                f"{type(client).__name__} != {expected_type.__name__}"
            )
        return client

    def __contains__(self, name: object) -> bool:
        return name in self._clients

    async def aclose_all(self) -> None:
        """登録済みのすべてのクライアントを登録の逆順にクローズする。"""
        errors: list[Exception] = []
        try:
            for name in reversed(self._order):
                client = self._clients.get(name)
                if client is None:
                    continue
                try:
                    await _close_client(client)
                except Exception as exc:
                    errors.append(exc)
        finally:
            self._clients.clear()
            self._order.clear()

        if errors:
            if len(errors) == 1:
                raise errors[0]
            raise ExceptionGroup("クライアント終了処理で複数のエラーが発生しました", errors)
