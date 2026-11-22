from typing import Annotated, cast

from fastapi import Depends, Request

from app.clients import ClientRegistry, TaskStore
from app.core.config import Settings

TASK_STORE_CLIENT_NAME = "task_store"


def get_settings(request: Request) -> Settings:
    """アプリケーション状態から設定オブジェクトを取得する。"""
    return cast(Settings, request.app.state.settings)


def get_client_registry(request: Request) -> ClientRegistry:
    """アプリケーション状態から外部クライアントレジストリを取得する。"""
    return cast(ClientRegistry, request.app.state.clients)


def get_task_store(
    registry: Annotated[ClientRegistry, Depends(get_client_registry)],
) -> TaskStore:
    """アプリケーション状態からタスク永続化ストアを取得する。"""
    # Protocol 型を型検証引数へ渡すため mypy の type-abstract を抑止する。
    return registry.require(TASK_STORE_CLIENT_NAME, TaskStore)  # type: ignore[type-abstract]
