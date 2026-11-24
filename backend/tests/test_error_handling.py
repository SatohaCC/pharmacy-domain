"""5要素UXモデルおよび Secure by Design エラー基盤の単体・統合テスト。"""

import ast
import io
import json
import logging
from contextvars import ContextVar
from pathlib import Path
from typing import Any, cast

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from pydantic import BaseModel

from app.application.error_mappers import from_domain_error
from app.application.errors import (
    ApplicationAuthorizationError,
    ApplicationBadRequestError,
    ApplicationConflictError,
    ApplicationError,
    ApplicationNotFoundError,
    ApplicationValidationError,
)
from app.domain.foundation.exceptions import (
    DomainAuthorizationError,
    DomainConflictError,
    DomainError,
    DomainNotFoundError,
    DomainValidationError,
)
from app.presentation.error_handlers import REQUEST_ID_HEADER, register_exception_handlers
from app.presentation.error_presenter import (
    present_application_error,
    present_http_error,
    present_request_validation_error,
    present_unexpected_error,
)

_BACKEND_ROOT = Path(__file__).resolve().parents[1]


def test_domain_error_sanitizes_and_falls_back_without_raising() -> None:
    err = DomainValidationError(
        "被保険者番号に空白やハイフンは使用できません。",
        code="FORBIDDEN_SEPARATOR_IN_INSURANCE_ID",
        details={"field": "insurance_number", "max_length": 20, "nullable": False},
    )

    assert err.code == "FORBIDDEN_SEPARATOR_IN_INSURANCE_ID"
    assert err.message == "被保険者番号に空白やハイフンは使用できません。"
    assert dict(err.details) == {
        "field": "insurance_number",
        "max_length": 20,
        "nullable": False,
    }
    with pytest.raises(TypeError):
        cast(Any, err.details)["field"] = "mutated"

    # 異常系での二次例外（500化）を防ぐため、不正入力は落とさずサニタイズ・フォールバックする。
    empty_msg = DomainValidationError("   \n\t  ")
    assert empty_msg.code == "VALIDATION_ERROR"
    assert empty_msg.message == "ドメインルール違反が発生しました。"

    bad_code = DomainConflictError("競合しました。", code="bad-code\nSECRET")
    assert bad_code.code == "CONFLICT"

    sanitized = DomainError(
        "制御文字\n付きメッセージ",
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
    )
    assert sanitized.code == "DOMAIN_ERROR"
    assert sanitized.message == "制御文字付きメッセージ"
    assert dict(sanitized.details) == {"valid_key": "nameinjected", "ok_float": 1.5}


def test_from_domain_error_preserves_metadata_and_maps_categories() -> None:
    cases: list[tuple[DomainError, type[ApplicationError], str]] = [
        (
            DomainNotFoundError(
                "対象が見つかりません。",
                code="CORPORATION_NOT_FOUND",
                details={"resource": "corporation"},
            ),
            ApplicationNotFoundError,
            "CORPORATION_NOT_FOUND",
        ),
        (
            DomainConflictError(
                "法人番号が重複しています。",
                code="DUPLICATE_CORPORATE_NUMBER",
                details={"field": "corporate_number"},
            ),
            ApplicationConflictError,
            "DUPLICATE_CORPORATE_NUMBER",
        ),
        (
            DomainAuthorizationError(
                "他店舗データにはアクセスできません。",
                code="CROSS_TENANT_ACCESS",
            ),
            ApplicationAuthorizationError,
            "CROSS_TENANT_ACCESS",
        ),
        (
            DomainValidationError("形式が不正です。"),
            ApplicationValidationError,
            "VALIDATION_ERROR",
        ),
        (
            DomainError("汎用ドメインエラー。"),
            ApplicationError,
            "DOMAIN_ERROR",
        ),
    ]

    for domain_err, expected_type, expected_code in cases:
        app_err = from_domain_error(domain_err, state_impact="draft_preserved")
        assert isinstance(app_err, expected_type)
        assert app_err.code == expected_code
        assert app_err.message == domain_err.message
        assert dict(app_err.details) == dict(domain_err.details)
        assert app_err.state_impact == "draft_preserved"

    # 不正な state_impact / 空メッセージ / 不正 code も落とさずフォールバックする。
    fallback_app = ApplicationError(
        "  ",
        code="invalid-app-code",
        state_impact=cast(Any, "invalid_impact"),
    )
    assert fallback_app.code == "APPLICATION_ERROR"
    assert fallback_app.message == "処理を実行できませんでした。"
    assert fallback_app.state_impact == "unchanged"


def test_error_presenter_builds_independent_five_elements_and_idor_concealment() -> None:
    app_err = ApplicationValidationError(
        "記号・番号に空白が含まれています。",
        code="FORBIDDEN_SEPARATOR_IN_INSURANCE_ID",
        details={"field": "insurance_number"},
        state_impact="draft_preserved",
    )
    status_code, response = present_application_error(app_err)

    assert status_code == 422
    assert response.code == "FORBIDDEN_SEPARATOR_IN_INSURANCE_ID"
    assert response.detail == "記号・番号に空白が含まれています。"
    assert response.title == "保険資格を登録できませんでした"
    assert response.reassurance == "入力中の下書きデータは保持されています。"
    assert not response.reassurance.endswith("ですが、")
    assert response.reason == "記号・番号に空白が含まれています。"
    assert response.how_to_fix == "記号と番号から空白や記号を取り除いて、再度入力してください。"
    assert response.details == {"field": "insurance_number"}
    assert [a.action_type for a in response.actions] == ["fix_input", "cancel"]

    # 通常の認可エラーは 403 FORBIDDEN を返すこと。
    forbidden_err = ApplicationAuthorizationError("承認権限がありません。")
    forbidden_status, forbidden_response = present_application_error(forbidden_err)
    assert forbidden_status == 403
    assert forbidden_response.code == "FORBIDDEN"

    # Presentation 層の IDOR 秘匿ポリシー対象コードは 404 NOT_FOUND に統一し、details も落とすこと。
    idor_err = ApplicationAuthorizationError(
        "他店舗の患者です。",
        code="CROSS_TENANT_ACCESS",
        details={"tenant": "other-pharmacy"},
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


def test_register_exception_handlers_integrates_all_error_paths() -> None:
    app = FastAPI()
    request_id_context: ContextVar[str] = ContextVar("test_request_id", default="req-fallback")
    stream = io.StringIO()
    logger = logging.getLogger("test.error_handlers")
    logger.setLevel(logging.INFO)
    handler = logging.StreamHandler(stream)
    logger.addHandler(handler)
    register_exception_handlers(app, logger=logger, request_id_context=request_id_context)

    class _Payload(BaseModel):
        count: int

    @app.post("/items")
    def create_item(payload: _Payload) -> dict[str, int]:
        return {"count": payload.count}

    @app.get("/app-bad-request")
    def raise_bad_request() -> None:
        raise ApplicationBadRequestError("更新項目を指定してください。", code="EMPTY_UPDATE")

    @app.get("/app-conflict")
    def raise_conflict() -> None:
        raise ApplicationConflictError(
            "他の操作と競合しました。",
            code="CORPORATION_CONFLICT",
            state_impact="unchanged",
        )

    @app.get("/app-idor")
    def raise_idor() -> None:
        raise ApplicationAuthorizationError(
            "別テナントのリソースです。",
            code="TENANT_FORBIDDEN",
            details={"secret_hint": "exists"},
        )

    @app.get("/http-503")
    def raise_http_503() -> None:
        raise HTTPException(status_code=503, detail="internal-secret-dsn")

    @app.get("/http-204", status_code=204)
    def raise_http_204() -> None:
        raise HTTPException(status_code=204)

    @app.get("/unexpected")
    def raise_unexpected() -> None:
        raise RuntimeError("sqlite3.OperationalError: /secret/path/app.db")

    try:
        client = TestClient(app, raise_server_exceptions=False)

        # 422 RequestValidationError: 生入力値が msg に含まれないこと。
        res_422 = client.post("/items", json={"count": "SECRET_RAW_INPUT"})
        assert res_422.status_code == 422
        body_422 = res_422.json()
        assert body_422["code"] == "VALIDATION_ERROR"
        assert "SECRET_RAW_INPUT" not in json.dumps(body_422, ensure_ascii=False)
        assert body_422["errors"] == [
            {"loc": ["body", "count"], "msg": "整数で入力してください。", "type": "int_parsing"}
        ]
        assert body_422["title"] == "入力内容を確認してください"

        # 400 ApplicationBadRequestError
        res_400 = client.get("/app-bad-request")
        assert res_400.status_code == 400
        assert res_400.json()["code"] == "EMPTY_UPDATE"
        assert res_400.json()["detail"] == "更新項目を指定してください。"

        # 409 ApplicationConflictError
        res_409 = client.get("/app-conflict")
        assert res_409.status_code == 409
        assert res_409.json()["reassurance"] == "既存のデータは変更されていません。"
        assert [a["action_type"] for a in res_409.json()["actions"]] == ["reload", "cancel"]

        # 403 -> 404 IDOR 秘匿
        res_idor = client.get("/app-idor")
        assert res_idor.status_code == 404
        assert res_idor.json()["code"] == "NOT_FOUND"
        assert "details" not in res_idor.json()
        assert "別テナント" not in res_idor.json()["reason"]

        # 503 HTTPException サニタイズ
        res_503 = client.get("/http-503")
        assert res_503.status_code == 503
        assert "internal-secret-dsn" not in json.dumps(res_503.json(), ensure_ascii=False)

        # 204 HTTPException（ボディなし）
        res_204 = client.get("/http-204")
        assert res_204.status_code == 204
        assert res_204.text == ""

        # 500 未処理例外サニタイズ + X-Request-ID
        res_500 = client.get("/unexpected")
        assert res_500.status_code == 500
        assert res_500.headers[REQUEST_ID_HEADER] == "req-fallback"
        body_500 = res_500.json()
        assert body_500["code"] == "INTERNAL_SERVER_ERROR"
        assert "/secret/path" not in json.dumps(body_500, ensure_ascii=False)
        assert "未処理の例外が発生しました" in stream.getvalue()
    finally:
        logger.removeHandler(handler)


def test_unexpected_error_without_default_request_id_context_falls_back_to_dash() -> None:
    app = FastAPI()
    no_default_context: ContextVar[str] = ContextVar("test_request_id_no_default")
    stream = io.StringIO()
    logger = logging.getLogger("test.error_handlers.no_default")
    logger.setLevel(logging.INFO)
    handler = logging.StreamHandler(stream)
    logger.addHandler(handler)
    register_exception_handlers(app, logger=logger, request_id_context=no_default_context)

    @app.get("/unexpected-no-default")
    def raise_unexpected() -> None:
        raise RuntimeError("boom")

    try:
        client = TestClient(app, raise_server_exceptions=False)
        res = client.get("/unexpected-no-default")
        assert res.status_code == 500
        assert res.headers[REQUEST_ID_HEADER] == "-"
        assert res.json()["code"] == "INTERNAL_SERVER_ERROR"
    finally:
        logger.removeHandler(handler)


def test_error_modules_respect_onion_layer_boundaries() -> None:
    def imported_modules(rel_path: str) -> set[str]:
        tree = ast.parse((_BACKEND_ROOT / rel_path).read_text(encoding="utf-8"))
        modules: set[str] = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                modules.update(alias.name for alias in node.names)
            elif isinstance(node, ast.ImportFrom) and node.module is not None:
                modules.add(node.module)
        return modules

    domain_imports = imported_modules("app/domain/foundation/exceptions.py")
    assert all(
        not mod.startswith(("app.", "fastapi", "pydantic", "sqlalchemy")) for mod in domain_imports
    )

    app_error_imports = imported_modules("app/application/errors.py")
    assert all(not mod.startswith("app.domain") for mod in app_error_imports)

    for presentation_file in (
        "app/presentation/dto/error.py",
        "app/presentation/error_presenter.py",
        "app/presentation/error_handlers.py",
    ):
        imports = imported_modules(presentation_file)
        assert all(not mod.startswith("app.domain") for mod in imports), presentation_file
