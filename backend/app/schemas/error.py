from pydantic import BaseModel


class ValidationErrorDetail(BaseModel):
    """リクエスト検証エラーの個別項目スキーマ。"""

    loc: list[str | int]
    msg: str
    type: str


class ErrorResponse(BaseModel):
    """エラーレスポンスの共通スキーマ。"""

    code: str
    detail: str
    errors: list[ValidationErrorDetail] | None = None
