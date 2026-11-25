"""エラーレスポンス用の公開 DTO。"""

from typing import Literal

from pydantic import BaseModel

type ErrorActionType = Literal[
    "cancel",
    "retry",
    "fix_input",
    "reload",
    "go_back",
    "save_draft",
    "contact_support",
]
type ErrorDetailScalar = str | int | float | bool | None


class ValidationErrorDetail(BaseModel):
    """入力検証エラーの詳細項目。"""

    loc: list[str | int]
    msg: str
    type: str


class ErrorAction(BaseModel):
    """エラー発生時にユーザーへ提示する推奨アクション。"""

    label: str
    action_type: ErrorActionType


class ErrorResponse(BaseModel):
    """5要素UXモデルに準拠した統一エラーレスポンス。"""

    code: str
    detail: str
    title: str
    reassurance: str
    reason: str
    how_to_fix: str
    way_out: str
    actions: list[ErrorAction]
    details: dict[str, ErrorDetailScalar] | None = None
    errors: list[ValidationErrorDetail] | None = None
