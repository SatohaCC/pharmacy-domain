from datetime import datetime

from app.clients.task_store import TaskRecord, TaskStore
from app.core.errors import AppError
from app.schemas.tasks import (
    TaskCreateRequest,
    TaskListResponse,
    TaskPriority,
    TaskResponse,
    TaskStatus,
    TaskUpdateRequest,
)


def _to_response(record: TaskRecord) -> TaskResponse:
    return TaskResponse(
        id=record.id,
        title=record.title,
        description=record.description,
        status=record.status,
        priority=record.priority,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


def list_tasks(
    store: TaskStore,
    *,
    status: TaskStatus | None = None,
    priority: TaskPriority | None = None,
    query: str | None = None,
) -> TaskListResponse:
    """条件に一致するタスク一覧を返す。"""
    normalized_query = query.strip() if query is not None and query.strip() else None
    records = store.list_tasks(status=status, priority=priority, query=normalized_query)
    items = [_to_response(record) for record in records]
    return TaskListResponse(items=items, total=len(items))


def get_task(store: TaskStore, task_id: str) -> TaskResponse:
    """指定 ID のタスクを取得する。存在しない場合は 404 エラーを送出する。"""
    record = store.get_task(task_id)
    if record is None:
        raise AppError("タスクが見つかりません", code="TASK_NOT_FOUND", status_code=404)
    return _to_response(record)


def create_task(
    store: TaskStore,
    payload: TaskCreateRequest,
    *,
    task_id: str,
    now: datetime,
) -> TaskResponse:
    """新規タスクを作成する。"""
    record = store.create_task(
        task_id=task_id,
        title=payload.title,
        description=payload.description,
        priority=payload.priority,
        created_at=now,
    )
    return _to_response(record)


def update_task(
    store: TaskStore,
    task_id: str,
    payload: TaskUpdateRequest,
    *,
    now: datetime,
) -> TaskResponse:
    """指定 ID のタスクを部分更新する。"""
    if not payload.model_fields_set:
        raise AppError(
            "更新する項目を 1 つ以上指定してください",
            code="EMPTY_UPDATE",
            status_code=400,
        )

    for field_name in ("title", "description", "status", "priority"):
        if field_name in payload.model_fields_set and getattr(payload, field_name) is None:
            raise AppError(
                "更新項目に null は指定できません",
                code="INVALID_UPDATE",
                status_code=400,
            )

    record = store.update_task(
        task_id,
        title=payload.title,
        description=payload.description,
        status=payload.status,
        priority=payload.priority,
        updated_at=now,
    )
    if record is None:
        raise AppError("タスクが見つかりません", code="TASK_NOT_FOUND", status_code=404)
    return _to_response(record)


def delete_task(store: TaskStore, task_id: str) -> None:
    """指定 ID のタスクを削除する。存在しない場合は 404 エラーを送出する。"""
    if not store.delete_task(task_id):
        raise AppError("タスクが見つかりません", code="TASK_NOT_FOUND", status_code=404)
