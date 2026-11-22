from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

TaskStatus = Literal["open", "done"]
TaskPriority = Literal["low", "medium", "high"]


class TaskCreateRequest(BaseModel):
    """タスク作成リクエストのスキーマ。"""

    title: str = Field(..., min_length=1, max_length=120)
    description: str = Field(default="", max_length=1000)
    priority: TaskPriority = "medium"

    @field_validator("title")
    @classmethod
    def _validate_title(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("タイトルを入力してください")
        return stripped

    @field_validator("description")
    @classmethod
    def _strip_description(cls, value: str) -> str:
        return value.strip()


class TaskUpdateRequest(BaseModel):
    """タスク部分更新リクエストのスキーマ。"""

    title: str | None = Field(default=None, max_length=120)
    description: str | None = Field(default=None, max_length=1000)
    status: TaskStatus | None = None
    priority: TaskPriority | None = None

    @field_validator("title")
    @classmethod
    def _validate_title(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            raise ValueError("タイトルを入力してください")
        return stripped

    @field_validator("description")
    @classmethod
    def _strip_description(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip()


class TaskResponse(BaseModel):
    """タスク単体のレスポンススキーマ。"""

    id: str
    title: str
    description: str
    status: TaskStatus
    priority: TaskPriority
    created_at: datetime
    updated_at: datetime


class TaskListResponse(BaseModel):
    """タスク一覧のレスポンススキーマ。"""

    items: list[TaskResponse]
    total: int
