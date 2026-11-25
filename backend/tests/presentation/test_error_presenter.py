"""presentation/error_presenter の単体テスト。"""

from typing import Any, cast

from app.application.foundation.errors import (
    ApplicationAuthorizationError,
    ApplicationConflictError,
    ApplicationError,
    ApplicationValidationError,
)
from app.presentation.error_presenter import (
    present_application_error,
    present_http_error,
    present_request_validation_error,
    present_unexpected_error,
)


def test_error_presenter_sanitizes_at_boundary_and_handles_idor_concealment() -> None:
    app_err = ApplicationConflictError(
        "同じ法人番号の法人が既に存在します。",
        code="DUPLICATE_CORPORATE_NUMBER",
        details={"field": "corporate_number"},
        state_impact="draft_preserved",
    )
    status_code, response = present_application_error(app_err)

    assert status_code == 409
    assert response.code == "DUPLICATE_CORPORATE_NUMBER"
    assert response.detail == "同じ法人番号の法人が既に存在します。"
    assert response.title == "法人情報を登録・更新できませんでした"
    assert response.reassurance == "入力中の下書きデータは保持されています。"
    assert not response.reassurance.endswith("ですが、")
    assert response.reason == "同じ法人番号の法人が既に存在します。"
    assert (
        response.how_to_fix
        == "法人番号に誤りがないか確認し、既存の法人情報と重複していないかご確認ください。"
    )
    assert response.details == {"field": "corporate_number"}
    assert [a.action_type for a in response.actions] == ["fix_input", "cancel"]

    # 不正な code・制御文字・空メッセージ・不正 details・不正 state_impact は境界で安全化する。
    dirty_err = ApplicationValidationError(
        "  制御文字\n付きメッセージ  ",
        code="bad-code\nSECRET",
        details=cast(
            Any,
            {
                "valid_key": "name\ninjected",
                "userId": 123,
                "nested": {"a": 1},
                "nan_val": float("nan"),
                "inf_val": float("inf"),
                "ok_float": 1.5,
            },
        ),
        state_impact=cast(Any, "invalid_impact"),
    )
    dirty_status, dirty_response = present_application_error(dirty_err)
    assert dirty_status == 422
    assert dirty_response.code == "VALIDATION_ERROR"
    assert dirty_response.detail == "制御文字付きメッセージ"
    assert dirty_response.reassurance == "既存のデータは変更されていません。"
    assert dirty_response.details == {"valid_key": "nameinjected", "ok_float": 1.5}

    empty_status, empty_response = present_application_error(ApplicationError("  \n\t "))
    assert empty_status == 400
    assert empty_response.detail == "処理を実行できませんでした。"

    # 通常の認可エラーは 403 FORBIDDEN を返すこと。
    forbidden_err = ApplicationAuthorizationError("承認権限がありません。")
    forbidden_status, forbidden_response = present_application_error(forbidden_err)
    assert forbidden_status == 403
    assert forbidden_response.code == "FORBIDDEN"

    # IDOR 秘匿フラグ指定時は 404 NOT_FOUND に統一し、details も落とすこと。
    idor_err = ApplicationAuthorizationError(
        "他店舗の患者です。",
        code="CROSS_TENANT_ACCESS",
        details={"tenant": "other-pharmacy"},
        conceal_as_not_found=True,
    )
    idor_status, idor_response = present_application_error(idor_err)
    assert idor_status == 404
    assert idor_response.code == "NOT_FOUND"
    assert idor_response.details is None
    assert "他店舗" not in idor_response.reason
    assert [a.action_type for a in idor_response.actions] == ["go_back", "contact_support"]

    # 5xx HTTP 例外・予期しない例外では生 detail を露出せず、虚偽の保存保証をしないこと。
    http_503 = present_http_error(503, code="HTTP_503", detail="DB password mismatch at /var/db")
    assert "DB" not in http_503.reason
    assert "/var/db" not in http_503.reason
    assert (
        http_503.reassurance
        == "処理結果が確定できていない可能性があります。最新の状態をご確認ください。"
    )

    unexpected = present_unexpected_error()
    assert unexpected.code == "INTERNAL_SERVER_ERROR"
    assert (
        unexpected.reassurance
        == "処理結果が確定できていない可能性があります。最新の状態をご確認ください。"
    )
    assert [a.action_type for a in unexpected.actions] == ["retry", "contact_support"]

    validation = present_request_validation_error([])
    assert validation.code == "VALIDATION_ERROR"
    assert [a.action_type for a in validation.actions] == ["fix_input", "cancel"]
