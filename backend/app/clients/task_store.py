from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import UTC, datetime
from threading import Lock
from typing import Literal, Protocol, runtime_checkable

from sqlalchemy import func, literal_column, or_, select
from sqlalchemy.engine import Connection, RowMapping

from app.clients.task_database import create_task_engine, tasks, upgrade_task_database

TaskStatus = Literal["open", "done"]
TaskPriority = Literal["low", "medium", "high"]


@dataclass(frozen=True)
class TaskRecord:
    """永続化されたタスク 1 件分のレコード。"""

    id: str
    title: str
    description: str
    status: TaskStatus
    priority: TaskPriority
    created_at: datetime
    updated_at: datetime


@runtime_checkable
class TaskStore(Protocol):
    """タスク永続化ストアの抽象プロトコル。"""

    def list_tasks(
        self,
        *,
        status: TaskStatus | None = None,
        priority: TaskPriority | None = None,
        query: str | None = None,
    ) -> list[TaskRecord]: ...

    def get_task(self, task_id: str) -> TaskRecord | None: ...

    def create_task(
        self,
        *,
        task_id: str,
        title: str,
        description: str,
        priority: TaskPriority,
        created_at: datetime,
    ) -> TaskRecord: ...

    def update_task(
        self,
        task_id: str,
        *,
        title: str | None = None,
        description: str | None = None,
        status: TaskStatus | None = None,
        priority: TaskPriority | None = None,
        updated_at: datetime,
    ) -> TaskRecord | None: ...

    def delete_task(self, task_id: str) -> bool: ...

    def close(self) -> None: ...


def _format_timestamp(value: datetime) -> str:
    aware = value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)
    return aware.isoformat()


def _parse_timestamp(raw: str) -> datetime:
    parsed = datetime.fromisoformat(raw)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def _row_to_record(row: RowMapping) -> TaskRecord:
    status_val: TaskStatus = "done" if row["status"] == "done" else "open"
    raw_priority = row["priority"]
    priority_val: TaskPriority = (
        "low" if raw_priority == "low" else "high" if raw_priority == "high" else "medium"
    )
    return TaskRecord(
        id=str(row["id"]),
        title=str(row["title"]),
        description=str(row["description"]),
        status=status_val,
        priority=priority_val,
        created_at=_parse_timestamp(str(row["created_at"])),
        updated_at=_parse_timestamp(str(row["updated_at"])),
    )


class SqliteTaskStore:
    """SQLAlchemy Core を用いたタスク永続化アダプタ。"""

    def __init__(self, database_path: str = "data/app.db") -> None:
        self._lock = Lock()
        self._closed = False
        self._engine = create_task_engine(database_path)
        try:
            upgrade_task_database(self._engine)
        except Exception:
            self._engine.dispose()
            raise

    @contextmanager
    def _transaction(self) -> Iterator[Connection]:
        with self._lock:
            if self._closed:
                raise RuntimeError("タスクストアは閉じられています。")
            with self._engine.begin() as connection:
                yield connection

    def list_tasks(
        self,
        *,
        status: TaskStatus | None = None,
        priority: TaskPriority | None = None,
        query: str | None = None,
    ) -> list[TaskRecord]:
        """絞り込み条件に一致するタスクを新しい順で返す。"""
        statement = select(tasks)
        if status is not None:
            statement = statement.where(tasks.c.status == status)
        if priority is not None:
            statement = statement.where(tasks.c.priority == priority)
        if query is not None:
            term = query.lower()
            statement = statement.where(
                or_(
                    func.UNICODE_LOWER(tasks.c.title).contains(term, autoescape=True, escape="!"),
                    func.UNICODE_LOWER(tasks.c.description).contains(
                        term, autoescape=True, escape="!"
                    ),
                )
            )
        statement = statement.order_by(tasks.c.created_at.desc(), literal_column("rowid").desc())
        with self._transaction() as connection:
            return [_row_to_record(row) for row in connection.execute(statement).mappings()]

    def get_task(self, task_id: str) -> TaskRecord | None:
        """指定 ID のタスクを取得する。存在しない場合は None を返す。"""
        statement = select(tasks).where(tasks.c.id == task_id)
        with self._transaction() as connection:
            row = connection.execute(statement).mappings().one_or_none()
        return _row_to_record(row) if row is not None else None

    def create_task(
        self,
        *,
        task_id: str,
        title: str,
        description: str,
        priority: TaskPriority,
        created_at: datetime,
    ) -> TaskRecord:
        """新しいタスクを SQLite に保存して返す。"""
        timestamp = _format_timestamp(created_at)
        statement = (
            tasks.insert()
            .values(
                id=task_id,
                title=title,
                description=description,
                status="open",
                priority=priority,
                created_at=timestamp,
                updated_at=timestamp,
            )
            .returning(*tasks.c)
        )
        with self._transaction() as connection:
            return _row_to_record(connection.execute(statement).mappings().one())

    def update_task(
        self,
        task_id: str,
        *,
        title: str | None = None,
        description: str | None = None,
        status: TaskStatus | None = None,
        priority: TaskPriority | None = None,
        updated_at: datetime,
    ) -> TaskRecord | None:
        """指定 ID のタスクを更新して返す。存在しない場合は None を返す。"""
        changes = {
            key: value
            for key, value in {
                "title": title,
                "description": description,
                "status": status,
                "priority": priority,
                "updated_at": _format_timestamp(updated_at),
            }.items()
            if value is not None
        }
        statement = (
            tasks.update().where(tasks.c.id == task_id).values(**changes).returning(*tasks.c)
        )
        with self._transaction() as connection:
            row = connection.execute(statement).mappings().one_or_none()
            return _row_to_record(row) if row is not None else None

    def delete_task(self, task_id: str) -> bool:
        """指定 ID のタスクを削除する。削除できた場合 True を返す。"""
        with self._transaction() as connection:
            return connection.execute(tasks.delete().where(tasks.c.id == task_id)).rowcount > 0

    def close(self) -> None:
        """SQLite の接続プールを閉じる。"""
        with self._lock:
            if not self._closed:
                self._engine.dispose()
                self._closed = True
