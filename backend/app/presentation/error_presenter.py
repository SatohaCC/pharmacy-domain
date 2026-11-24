"""プレゼンテーション層における5要素エラーレスポンス変換。"""

from dataclasses import dataclass

from app.application.errors import (
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

_REASSURANCE_BY_STATE_IMPACT: dict[StateImpact, str] = {
    "unchanged": "既存のデータは変更されていません。",
    "draft_preserved": "入力中の下書きデータは保持されています。",
    "unknown": "処理結果が確定できていない可能性があります。最新の状態をご確認ください。",
}


@dataclass(frozen=True, slots=True)
class ErrorPresentationSpec:
    """エラーコード単位の5要素表示仕様および境界ポリシー。"""

    title: str
    how_to_fix: str
    way_out: str = _DEFAULT_WAY_OUT
    reassurance: str | None = None
    actions: tuple[ErrorAction, ...] | None = None
    conceal_as_not_found: bool = False


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
    # 薬局ドメイン共通カタログ
    "MISSING_RESIDUAL_STATUS": ErrorPresentationSpec(
        title="薬歴を確定できませんでした",
        how_to_fix="残薬がない場合でも「残薬なし」と入力して、再度確定してください。",
    ),
    "PROXY_APPROVAL_REQUIRED": ErrorPresentationSpec(
        title="レセプト請求へ進めません",
        how_to_fix="担当の保険薬剤師に内容確認と承認を依頼してください。",
        way_out="承認権限に関する問題は、システム管理者へご連絡ください。",
        actions=(
            ErrorAction(label="前の画面へ戻る", action_type="go_back"),
            ErrorAction(label="サポートへ問い合わせ", action_type="contact_support"),
        ),
    ),
    "FORBIDDEN_SEPARATOR_IN_INSURANCE_ID": ErrorPresentationSpec(
        title="保険資格を登録できませんでした",
        how_to_fix="記号と番号から空白や記号を取り除いて、再度入力してください。",
        way_out="資格確認書の記載が特殊な場合は、サポート窓口へお問い合わせください。",
        actions=_INPUT_ACTIONS,
    ),
    "CROSS_TENANT_ACCESS": ErrorPresentationSpec(
        title="対象のデータが見つかりませんでした",
        how_to_fix="URL や対象が正しいかご確認のうえ、一覧から再度お選びください。",
        actions=_NOT_FOUND_ACTIONS,
        conceal_as_not_found=True,
    ),
    "TENANT_FORBIDDEN": ErrorPresentationSpec(
        title="対象のデータが見つかりませんでした",
        how_to_fix="URL や対象が正しいかご確認のうえ、一覧から再度お選びください。",
        actions=_NOT_FOUND_ACTIONS,
        conceal_as_not_found=True,
    ),
    # 法人コンテキストカタログ
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


def _to_details_dict(exc: ApplicationError) -> dict[str, ErrorDetailScalar] | None:
    if not exc.details:
        return None
    return dict(exc.details)


def present_application_error(exc: ApplicationError) -> tuple[int, ErrorResponse]:
    """ApplicationError を HTTP ステータスと 5要素 ErrorResponse へ変換する。"""
    spec = _ERROR_SPECS.get(exc.code)
    if (
        isinstance(exc, ApplicationAuthorizationError)
        and spec is not None
        and spec.conceal_as_not_found
    ):
        reason = "指定されたリソースが見つかりません。"
        return (
            404,
            ErrorResponse(
                code="NOT_FOUND",
                detail=reason,
                title=spec.title,
                reassurance=_REASSURANCE_BY_STATE_IMPACT["unchanged"],
                reason=reason,
                how_to_fix=spec.how_to_fix,
                way_out=spec.way_out,
                actions=list(spec.actions or _NOT_FOUND_ACTIONS),
                details=None,
            ),
        )

    status_code, default_title, default_fix, default_actions = (
        _resolve_application_category_defaults(exc)
    )
    reassurance = (
        spec.reassurance
        if spec is not None and spec.reassurance is not None
        else _REASSURANCE_BY_STATE_IMPACT[exc.state_impact]
    )
    how_to_fix = spec.how_to_fix if spec is not None else default_fix
    actions = spec.actions if spec is not None and spec.actions is not None else default_actions

    return (
        status_code,
        ErrorResponse(
            code=exc.code,
            detail=exc.message,
            title=spec.title if spec is not None else default_title,
            reassurance=reassurance,
            reason=exc.message,
            how_to_fix=how_to_fix,
            way_out=spec.way_out if spec is not None else _DEFAULT_WAY_OUT,
            actions=list(actions),
            details=_to_details_dict(exc),
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
    if status_code >= 500:
        reason = "サーバー側の一時的な問題により処理を完了できませんでした。"
        return ErrorResponse(
            code=code,
            detail=reason,
            title="処理を完了できませんでした",
            reassurance=_REASSURANCE_BY_STATE_IMPACT["unknown"],
            reason=reason,
            how_to_fix="しばらく時間をおいてから、最新の状態を確認のうえ再度お試しください。",
            way_out=_SUPPORT_WAY_OUT,
            actions=list(_SYSTEM_ACTIONS),
        )

    safe_reason = (
        detail.strip()
        if isinstance(detail, str) and detail.strip()
        else "リクエストを処理できませんでした。"
    )
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
        code=code,
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
