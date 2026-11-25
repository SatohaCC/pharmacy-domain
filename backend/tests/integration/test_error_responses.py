"""アプリケーション全体の HTTP エラーレスポンス統合テスト。"""

from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.application.foundation.errors import ApplicationNotFoundError
from app.infrastructure.config import Settings
from app.main import create_app


def test_application_error_handler_returns_structured_error_response() -> None:
    app = create_app(Settings())

    @app.get("/api/test-error")
    def raise_error() -> None:
        raise ApplicationNotFoundError("対象のリソースが見つかりません", code="NOT_FOUND")

    client = TestClient(app)

    response = client.get("/api/test-error")

    assert response.status_code == 404
    assert response.json() == {
        "code": "NOT_FOUND",
        "detail": "対象のリソースが見つかりません",
        "title": "対象のデータが見つかりませんでした",
        "reassurance": "既存のデータは変更されていません。",
        "reason": "対象のリソースが見つかりません",
        "how_to_fix": (
            "対象が削除または変更されていないかご確認のうえ、一覧から再度お選びください。"
        ),
        "way_out": "問題が解決しない場合は、管理薬剤師またはサポート窓口へお問い合わせください。",
        "actions": [
            {"label": "一覧へ戻る", "action_type": "go_back"},
            {"label": "サポートへ問い合わせ", "action_type": "contact_support"},
        ],
    }


def test_validation_error_returns_unified_error_response() -> None:
    app = create_app(Settings())

    @app.get("/api/items/{item_id}")
    def read_item(item_id: int) -> dict[str, int]:
        return {"item_id": item_id}

    client = TestClient(app)

    response = client.get("/api/items/not-an-int")

    assert response.status_code == 422
    payload = response.json()
    assert payload["code"] == "VALIDATION_ERROR"
    assert payload["detail"] == "入力内容に誤りがあります。"
    assert payload["title"] == "入力内容を確認してください"
    assert payload["reassurance"] == "既存のデータは変更されていません。"
    assert payload["reason"] == "入力内容に誤りがあります。"
    assert isinstance(payload["errors"], list)
    assert payload["errors"][0] == {
        "loc": ["path", "item_id"],
        "msg": "整数で入力してください。",
        "type": "int_parsing",
    }


def test_http_404_and_405_return_unified_error_response() -> None:
    app = create_app(Settings())
    client = TestClient(app)

    not_found = client.get("/api/unknown-endpoint")
    method_not_allowed = client.post("/api/health")

    assert not_found.status_code == 404
    assert not_found.json() == {
        "code": "NOT_FOUND",
        "detail": "Not Found",
        "title": "対象のデータまたはページが見つかりませんでした",
        "reassurance": "既存のデータは変更されていません。",
        "reason": "Not Found",
        "how_to_fix": "URL や指定した対象が正しいかご確認のうえ、前の画面へお戻りください。",
        "way_out": "問題が解決しない場合は、管理薬剤師またはサポート窓口へお問い合わせください。",
        "actions": [
            {"label": "一覧へ戻る", "action_type": "go_back"},
            {"label": "サポートへ問い合わせ", "action_type": "contact_support"},
        ],
    }

    assert method_not_allowed.status_code == 405
    assert method_not_allowed.json() == {
        "code": "METHOD_NOT_ALLOWED",
        "detail": "Method Not Allowed",
        "title": "許可されていない操作です",
        "reassurance": "既存のデータは変更されていません。",
        "reason": "Method Not Allowed",
        "how_to_fix": "入力内容や操作手順をご確認のうえ、もう一度お試しください。",
        "way_out": "問題が解決しない場合は、管理薬剤師またはサポート窓口へお問い合わせください。",
        "actions": [
            {"label": "入力を修正する", "action_type": "fix_input"},
            {"label": "キャンセル", "action_type": "cancel"},
        ],
    }
    assert "GET" in method_not_allowed.headers.get("allow", "")


def test_http_exception_without_allowed_body_returns_empty_response() -> None:
    app = create_app(Settings())

    @app.get("/api/test-not-modified")
    def not_modified() -> None:
        raise HTTPException(status_code=304)

    client = TestClient(app)

    response = client.get("/api/test-not-modified")

    assert response.status_code == 304
    assert response.content == b""
