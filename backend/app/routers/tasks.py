import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response

from app.clients import TaskStore
from app.routers.dependencies import get_task_store
from app.schemas.error import ErrorResponse
from app.schemas.tasks import (
    TaskCreateRequest,
    TaskListResponse,
    TaskPriority,
    TaskResponse,
    TaskStatus,
    TaskUpdateRequest,
)
from app.services import tasks as task_service

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


@router.get("", response_model=TaskListResponse)
def list_tasks_endpoint(
    store: Annotated[TaskStore, Depends(get_task_store)],
    status: Annotated[TaskStatus | None, Query()] = None,
    priority: Annotated[TaskPriority | None, Query()] = None,
    q: Annotated[str | None, Query(max_length=120)] = None,
) -> TaskListResponse:
    """絞り込み条件に一致するタスク一覧を返す。"""
    return task_service.list_tasks(store, status=status, priority=priority, query=q)


@router.post(
    "",
    response_model=TaskResponse,
    status_code=201,
    responses={422: {"model": ErrorResponse}},
)
def create_task_endpoint(
    payload: TaskCreateRequest,
    store: Annotated[TaskStore, Depends(get_task_store)],
) -> TaskResponse:
    """新規タスクを作成する。"""
    return task_service.create_task(
        store,
        payload,
        task_id=uuid.uuid4().hex,
        now=datetime.now(UTC),
    )


@router.get(
    "/{task_id}",
    response_model=TaskResponse,
    responses={404: {"model": ErrorResponse}},
)
def get_task_endpoint(
    task_id: str,
    store: Annotated[TaskStore, Depends(get_task_store)],
) -> TaskResponse:
    """指定 ID のタスクを取得する。"""
    return task_service.get_task(store, task_id)


@router.patch(
    "/{task_id}",
    response_model=TaskResponse,
    responses={
        400: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
    },
)
def update_task_endpoint(
    task_id: str,
    payload: TaskUpdateRequest,
    store: Annotated[TaskStore, Depends(get_task_store)],
) -> TaskResponse:
    """指定 ID のタスクを部分更新する。"""
    return task_service.update_task(
        store,
        task_id,
        payload,
        now=datetime.now(UTC),
    )


@router.delete(
    "/{task_id}",
    status_code=204,
    responses={404: {"model": ErrorResponse}},
)
def delete_task_endpoint(
    task_id: str,
    store: Annotated[TaskStore, Depends(get_task_store)],
) -> Response:
    """指定 ID のタスクを削除する。"""
    task_service.delete_task(store, task_id)
    return Response(status_code=204)
