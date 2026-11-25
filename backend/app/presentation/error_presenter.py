"""プレゼンテーション層における5要素エラーレスポンス変換。"""

import math
import re
from collections.abc import Mapping
from dataclasses import dataclass

from app.application.foundation.errors import (
    ApplicationAuthorizationError,
    ApplicationBadRequestError,
    ApplicationConflictError,
    ApplicationError,
    ApplicationNotFoundError,
    ApplicationValidationError,
    StateImpact,
)
from app.presentation.dto.error import (
    ErrorAction,
    ErrorDetailScalar,
    ErrorResponse,
    ValidationErrorDetail,
)

_DEFAULT_WAY_OUT = "問題が解決しない場合は、管理薬剤師またはサポート窓口へお問い合わせください。"
_SUPPORT_WAY_OUT = "問題が繰り返し発生する場合は、サポート窓口へお問い合わせください。"
_DEFAULT_MESSAGE = "処理を実行できませんでした。"

_ERROR_CODE_PATTERN = re.compile(r"^[A-Z][A-Z0-9_]*$")
_DETAIL_KEY_PATTERN = re.compile(r"^[a-z][a-z0-9_]*$")
_CONTROL_CHAR_PATTERN = re.compile(r"[\x00-\x1f\x7f]")

_REASSURANCE_BY_STATE_IMPACT: dict[StateImpact, str] = {
    "unchanged": "既存のデータは変更されていません。",
    "draft_preserved": "入力中の下書きデータは保持されています。",
    "unknown": "処理結果が確定できていない可能性があります。最新の状態をご確認ください。",
}


@dataclass(frozen=True, slots=True)
class ErrorPresentationSpec:
    """エラーコード単位の5要素表示仕様。"""

    title: str
    how_to_fix: str
    way_out: str = _DEFAULT_WAY_OUT
    reassurance: str | None = None
    actions: tuple[ErrorAction, ...] | None = None


_INPUT_ACTIONS = (
    ErrorAction(label="入力を修正する", action_type="fix_input"),
    ErrorAction(label="キャンセル", action_type="cancel"),
)
_CONFLICT_ACTIONS = (
    ErrorAction(label="最新データを再読み込み", action_type="reload"),
    ErrorAction(label="キャンセル", action_type="cancel"),
)
_NOT_FOUND_ACTIONS = (
    ErrorAction(label="一覧へ戻る", action_type="go_back"),
    ErrorAction(label="サポートへ問い合わせ", action_type="contact_support"),
)
_FORBIDDEN_ACTIONS = (
    ErrorAction(label="前の画面へ戻る", action_type="go_back"),
    ErrorAction(label="サポートへ問い合わせ", action_type="contact_support"),
)
_SYSTEM_ACTIONS = (
    ErrorAction(label="再試行", action_type="retry"),
    ErrorAction(label="サポートへ問い合わせ", action_type="contact_support"),
)

_ERROR_SPECS: dict[str, ErrorPresentationSpec] = {
    "CORPORATION_NOT_FOUND": ErrorPresentationSpec(
        title="法人情報が見つかりませんでした",
        how_to_fix="対象が削除または変更されていないか一覧画面で確認のうえ、再度選択してください。",
        actions=_NOT_FOUND_ACTIONS,
    ),
    "DUPLICATE_CORPORATE_NUMBER": ErrorPresentationSpec(
        title="法人情報を登録・更新できませんでした",
        how_to_fix="法人番号に誤りがないか確認し、既存の法人情報と重複していないかご確認ください。",
        actions=_INPUT_ACTIONS,
    ),
    "EMPTY_UPDATE": ErrorPresentationSpec(
        title="法人情報を更新できませんでした",
        how_to_fix="変更したい項目を 1 つ以上入力または選択してから、再度保存してください。",
        actions=_INPUT_ACTIONS,
    ),
    "INVALID_UPDATE": ErrorPresentationSpec(
        title="法人情報を更新できませんでした",
        how_to_fix="更新対象と入力値、および法人の現在の存続状態をご確認のうえ再度お試しください。",
        actions=_INPUT_ACTIONS,
    ),
    "INVALID_CORPORATION_TRANSITION": ErrorPresentationSpec(
        title="法人の存続状態を変更できませんでした",
        how_to_fix="現在の存続状態から遷移可能な状態をご確認のうえ、再度選択してください。",
        actions=_CONFLICT_ACTIONS,
    ),
    "CORPORATION_CONFLICT": ErrorPresentationSpec(
        title="法人データの更新が競合しました",
        how_to_fix="他の操作と同時に更新された可能性があります。最新の状態を再読み込みしてから再度お試しください。",
        actions=_CONFLICT_ACTIONS,
    ),
}

_HTTP_STATUS_TITLES: dict[int, str] = {
    400: "リクエストを処理できませんでした",
    401: "認証が必要です",
    403: "操作を実行する権限がありません",
    404: "対象のデータまたはページが見つかりませんでした",
    405: "許可されていない操作です",
    409: "データの競合が発生しました",
    422: "入力内容を確認してください",
    429: "リクエストが集中しています",
}


def _sanitize_code(code: str, fallback: str) -> str:
    if isinstance(code, str) and _ERROR_CODE_PATTERN.fullmatch(code):
        return code
    return fallback


def _sanitize_text(text: str, fallback: str = _DEFAULT_MESSAGE) -> str:
    if not isinstance(text, str):
        return fallback
    cleaned = _CONTROL_CHAR_PATTERN.sub("", text).strip()
    return cleaned if cleaned else fallback


def _sanitize_details(
    details: Mapping[str, ErrorDetailScalar],
) -> dict[str, ErrorDetailScalar] | None:
    if not details:
        return None
    normalized: dict[str, ErrorDetailScalar] = {}
    for key, value in details.items():
        if not isinstance(key, str) or not _DETAIL_KEY_PATTERN.fullmatch(key):
            continue
        if value is None or isinstance(value, bool | int):
            normalized[key] = value
        elif isinstance(value, float):
            if math.isfinite(value):
                normalized[key] = value
        elif isinstance(value, str):
            normalized[key] = _CONTROL_CHAR_PATTERN.sub("", value)
    return normalized or None


def _resolve_application_category_defaults(
    exc: ApplicationError,
) -> tuple[int, str, str, tuple[ErrorAction, ...]]:
    if isinstance(exc, ApplicationBadRequestError):
        return (
            400,
            "リクエストを処理できませんでした",
            "指定内容をご確認のうえ、もう一度お試しください。",
            _INPUT_ACTIONS,
        )
    if isinstance(exc, ApplicationAuthorizationError):
        return (
            403,
            "操作を実行する権限がありません",
            "必要な権限を持つアカウントでログインしているかご確認ください。",
            _FORBIDDEN_ACTIONS,
        )
    if isinstance(exc, ApplicationNotFoundError):
        return (
            404,
            "対象のデータが見つかりませんでした",
            "対象が削除または変更されていないかご確認のうえ、一覧から再度お選びください。",
            _NOT_FOUND_ACTIONS,
        )
    if isinstance(exc, ApplicationConflictError):
        return (
            409,
            "データの競合が発生しました",
            "最新の状態を再読み込みしてから、もう一度お試しください。",
            _CONFLICT_ACTIONS,
        )
    if isinstance(exc, ApplicationValidationError):
        return (
            422,
            "入力内容を確認してください",
            "入力項目の形式や必須項目をご確認のうえ、修正して再度お試しください。",
            _INPUT_ACTIONS,
        )
    return (
        400,
        "処理を完了できませんでした",
        "入力内容や操作手順をご確認のうえ、もう一度お試しください。",
        _INPUT_ACTIONS,
    )


def present_application_error(exc: ApplicationError) -> tuple[int, ErrorResponse]:
    """ApplicationError を HTTP ステータスと 5要素 ErrorResponse へ変換する。"""
    if isinstance(exc, ApplicationAuthorizationError) and exc.conceal_as_not_found:
        reason = "指定されたリソースが見つかりません。"
        return (
            404,
            ErrorResponse(
                code="NOT_FOUND",
                detail=reason,
                title="対象のデータが見つかりませんでした",
                reassurance=_REASSURANCE_BY_STATE_IMPACT["unchanged"],
                reason=reason,
                how_to_fix="URL や対象が正しいかご確認のうえ、一覧から再度お選びください。",
                way_out=_DEFAULT_WAY_OUT,
                actions=list(_NOT_FOUND_ACTIONS),
                details=None,
            ),
        )

    status_code, default_title, default_fix, default_actions = (
        _resolve_application_category_defaults(exc)
    )
    safe_code = _sanitize_code(exc.code, exc.default_code)
    safe_message = _sanitize_text(exc.message)
    spec = _ERROR_SPECS.get(safe_code)
    reassurance = (
        spec.reassurance
        if spec is not None and spec.reassurance is not None
        else _REASSURANCE_BY_STATE_IMPACT.get(
            exc.state_impact, _REASSURANCE_BY_STATE_IMPACT["unchanged"]
        )
    )
    how_to_fix = spec.how_to_fix if spec is not None else default_fix
    actions = spec.actions if spec is not None and spec.actions is not None else default_actions

    return (
        status_code,
        ErrorResponse(
            code=safe_code,
            detail=safe_message,
            title=spec.title if spec is not None else default_title,
            reassurance=reassurance,
            reason=safe_message,
            how_to_fix=how_to_fix,
            way_out=spec.way_out if spec is not None else _DEFAULT_WAY_OUT,
            actions=list(actions),
            details=_sanitize_details(exc.details),
        ),
    )


def present_request_validation_error(errors: list[ValidationErrorDetail]) -> ErrorResponse:
    """リクエスト検証エラー（422）を安全な 5要素 ErrorResponse へ変換する。"""
    reason = "入力内容に誤りがあります。"
    return ErrorResponse(
        code="VALIDATION_ERROR",
        detail=reason,
        title="入力内容を確認してください",
        reassurance=_REASSURANCE_BY_STATE_IMPACT["unchanged"],
        reason=reason,
        how_to_fix="エラーが指摘された項目の入力形式や必須項目をご確認のうえ、修正して再度お試しください。",
        way_out=_DEFAULT_WAY_OUT,
        actions=list(_INPUT_ACTIONS),
        errors=errors,
    )


def present_http_error(
    status_code: int,
    *,
    code: str,
    detail: str | None = None,
) -> ErrorResponse:
    """HTTP 例外を 5要素 ErrorResponse へ変換する（5xx は内部詳細をサニタイズする）。"""
    safe_code = _sanitize_code(code, f"HTTP_{status_code}")
    if status_code >= 500:
        reason = "サーバー側の一時的な問題により処理を完了できませんでした。"
        return ErrorResponse(
            code=safe_code,
            detail=reason,
            title="処理を完了できませんでした",
            reassurance=_REASSURANCE_BY_STATE_IMPACT["unknown"],
            reason=reason,
            how_to_fix="しばらく時間をおいてから、最新の状態を確認のうえ再度お試しください。",
            way_out=_SUPPORT_WAY_OUT,
            actions=list(_SYSTEM_ACTIONS),
        )

    safe_reason = _sanitize_text(detail or "", "リクエストを処理できませんでした。")
    title = _HTTP_STATUS_TITLES.get(status_code, "リクエストを処理できませんでした")
    if status_code == 404:
        how_to_fix = "URL や指定した対象が正しいかご確認のうえ、前の画面へお戻りください。"
        actions = _NOT_FOUND_ACTIONS
    elif status_code in (401, 403):
        how_to_fix = (
            "ログイン状態やアクセス権限をご確認のうえ、必要に応じて再ログインしてください。"
        )
        actions = _FORBIDDEN_ACTIONS
    elif status_code == 409:
        how_to_fix = "最新の状態を再読み込みしてから、もう一度お試しください。"
        actions = _CONFLICT_ACTIONS
    elif status_code == 429:
        how_to_fix = "しばらく時間をおいてから、もう一度お試しください。"
        actions = _SYSTEM_ACTIONS
    else:
        how_to_fix = "入力内容や操作手順をご確認のうえ、もう一度お試しください。"
        actions = _INPUT_ACTIONS

    return ErrorResponse(
        code=safe_code,
        detail=safe_reason,
        title=title,
        reassurance=_REASSURANCE_BY_STATE_IMPACT["unchanged"],
        reason=safe_reason,
        how_to_fix=how_to_fix,
        way_out=_DEFAULT_WAY_OUT,
        actions=list(actions),
    )


def present_unexpected_error() -> ErrorResponse:
    """予期しないシステム例外（500）を安全な 5要素 ErrorResponse へ変換する。"""
    reason = "サーバー内部の一時的な問題により処理を完了できませんでした。"
    return ErrorResponse(
        code="INTERNAL_SERVER_ERROR",
        detail=reason,
        title="処理を完了できませんでした",
        reassurance=_REASSURANCE_BY_STATE_IMPACT["unknown"],
        reason=reason,
        how_to_fix="しばらく時間をおいてから、最新の状態を確認のうえ再度お試しください。",
        way_out=_SUPPORT_WAY_OUT,
        actions=list(_SYSTEM_ACTIONS),
    )
