"""法人の有効日と登録時点の履歴、吸収合併、移行を検証する。"""

from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import Engine, text

from app.application.auth.contracts import AuthPrincipal
from app.infrastructure.config import Settings
from app.main import APP_ENGINE_RESOURCE_NAME, create_app
from app.presentation.dependencies import get_current_auth_principal

_ALEMBIC = Path(__file__).resolve().parents[2] / "alembic.ini"


def _vendor_principal() -> AuthPrincipal:
    return AuthPrincipal(
        user_id="vendor-admin-1",
        email="admin@vendor.example.com",
        display_name="システム管理者",
        scope_type="vendor",
        tenant_id=None,
        roles=("vendor_admin",),
    )


@pytest.fixture
def client(tmp_path: Path) -> Iterator[TestClient]:
    app = create_app(Settings(database_path=str(tmp_path / "history.sqlite3")))
    app.dependency_overrides[get_current_auth_principal] = _vendor_principal
    config = Config(str(_ALEMBIC))
    with TestClient(app, headers={"X-Requested-With": "XMLHttpRequest"}) as client:
        engine = app.state.resources.require(APP_ENGINE_RESOURCE_NAME, Engine)
        with engine.begin() as connection:
            config.attributes["connection"] = connection
            command.upgrade(config, "head")
        yield client


def _register(client: TestClient, name: str) -> str:
    response = client.post(
        "/api/corporations",
        json={
            "category": "corporation",
            "name": name,
            "address": "東京都",
            "valid_from": "2025-01-01",
            "evidence": "登記を確認",
        },
    )
    assert response.status_code == 201, response.text
    return f"/api/corporations/{response.json()['id']}"


def test_corrections_after_merger_preserve_recorded_state_and_latest_identity(
    client: TestClient,
) -> None:
    path = _register(client, "旧称")
    survivor = _register(client, "存続法人").rsplit("/", 1)[1]
    original = client.get(f"{path}/history").json()[0]
    updated = client.patch(
        path,
        json={
            "name": "新称",
            "address": "大阪府",
            "valid_from": "2025-03-01",
            "evidence": "移転登記",
        },
    )
    assert updated.status_code == 200, updated.text
    merged = client.post(
        f"{path}/merge",
        json={
            "surviving_corporation_id": survivor,
            "effective_date": "2025-02-15",
            "evidence": "合併契約",
        },
    )
    assert merged.status_code == 200, merged.text
    assert merged.json()["name"] == "新称"

    corrected = client.patch(
        f"{path}/history",
        json={
            "as_of": "2025-01-15",
            "name": "訂正された旧称",
            "address": "神奈川県",
            "corporate_number": "1234567890123",
            "evidence": "当時の登記を再確認",
        },
    )
    recorded_original = client.get(
        path,
        params={
            "as_of": "2025-01-15",
            "recorded_as_of": original["recorded_at"],
        },
    )
    before_merger = client.get(path, params={"as_of": "2025-02-14"})
    at_merger = client.get(path, params={"as_of": "2025-02-15"})
    after_profile_change = client.get(path, params={"as_of": "2025-03-01"})
    history = client.get(f"{path}/history").json()
    as_known_before_merger = client.get(
        path, params={"as_of": "2025-02-15", "recorded_as_of": history[1]["recorded_at"]}
    )
    as_known_at_merger = client.get(
        path, params={"as_of": "2025-02-15", "recorded_as_of": history[2]["recorded_at"]}
    )

    assert corrected.status_code == 200, corrected.text
    assert corrected.json()["valid_to"] == "2025-02-15"
    assert recorded_original.json()["name"] == "旧称"
    assert recorded_original.json()["address"] == "東京都"
    assert before_merger.json()["name"] == "訂正された旧称"
    assert before_merger.json()["corporate_number"] == "1234567890123"
    assert before_merger.json()["status"] == "active"
    assert at_merger.json()["status"] == after_profile_change.json()["status"] == "merged_out"
    assert as_known_before_merger.json()["status"] == "active"
    assert as_known_at_merger.json()["status"] == "merged_out"
    assert after_profile_change.json()["name"] == "新称"
    assert after_profile_change.json()["address"] == "大阪府"
    assert client.get(path).json()["id"] == merged.json()["id"]
    assert [item["kind"] for item in history] == ["registration", "profile", "merger", "correction"]
    assert history[0]["evidence"] == "登記を確認"
    assert history[2]["evidence"] == "合併契約"
    assert history[2]["valid_from"] == "2025-02-15"
    assert history[2]["surviving_corporation_id"] == survivor


def test_merge_rejects_nonexistent_and_self_successor_without_changing_history(
    client: TestClient,
) -> None:
    path = _register(client, "現法人")
    evidence = {"effective_date": "2025-02-01", "evidence": "合併の根拠"}

    missing = client.post(f"{path}/merge", json={**evidence, "surviving_corporation_id": "missing"})
    own_id = path.rsplit("/", 1)[1]
    self_merge = client.post(f"{path}/merge", json={**evidence, "surviving_corporation_id": own_id})

    assert (missing.status_code, missing.json()["code"]) == (404, "CORPORATION_NOT_FOUND")
    assert (self_merge.status_code, self_merge.json()["code"]) == (422, "SELF_CORPORATION_MERGER")
    assert client.get(path).json()["status"] == "active"
    assert len(client.get(f"{path}/history").json()) == 1


@pytest.mark.parametrize("terminal_status", ["dissolved", "merged_out"])
def test_corrects_a_known_terminal_snapshot_without_restoring_active_status(
    client: TestClient,
    terminal_status: str,
) -> None:
    path = _register(client, "当初の法人名")
    transition = client.patch(
        f"{path}/status",
        json={"status": terminal_status, "effective_date": "2025-02-01"},
    )
    assert transition.status_code == 200, transition.text

    correction = client.patch(
        f"{path}/history",
        json={
            "as_of": "2025-02-10",
            "corporate_number": "1234567890123",
            "evidence": "当時の法人番号を確認",
        },
    )

    assert correction.status_code == 200, correction.text
    assert correction.json()["corporation"]["status"] == terminal_status
    assert client.get(path).json()["status"] == terminal_status
    assert client.get(path).json()["corporate_number"] == "1234567890123"
    earlier = client.get(path, params={"as_of": "2025-01-31"})
    assert earlier.json()["status"] == "active"
    assert earlier.json()["corporate_number"] is None
    assert client.get(f"{path}/history").json()[1]["surviving_corporation_id"] is None


def test_migration_keeps_legacy_rows_and_leaves_unknown_past_unfilled(tmp_path: Path) -> None:
    app = create_app(Settings(database_path=str(tmp_path / "legacy.sqlite3")))
    app.dependency_overrides[get_current_auth_principal] = _vendor_principal
    config = Config(str(_ALEMBIC))
    with TestClient(app) as client:
        engine = app.state.resources.require(APP_ENGINE_RESOURCE_NAME, Engine)
        with engine.begin() as connection:
            config.attributes["connection"] = connection
            command.upgrade(config, "0002_corporate_relations")
            connection.execute(
                text(
                    "INSERT INTO corporations "
                    "(id, category, name, address, status, created_at, updated_at) "
                    "VALUES ('legacy', 'corporation', '既存法人', '', 'active', "
                    "'2025-01-01T00:00:00+00:00', '2025-05-01T16:00:00+00:00'), "
                    "('target', 'corporation', '関係先', '', 'active', "
                    "'2025-01-01T00:00:00+00:00', '2025-01-01T00:00:00+00:00')"
                )
            )
            connection.execute(
                text(
                    "INSERT INTO corporate_relations "
                    "VALUES ('legacy-relation', 'legacy', 'target', 'affiliate')"
                )
            )
            connection.execute(
                text(
                    "INSERT INTO corporate_relation_revisions "
                    "(relation_id, recorded_at, valid_from, evidence, confirmation_status) "
                    "VALUES ('legacy-relation', '2025-05-02T00:00:00+00:00', "
                    "'2025-05-02', '既存の根拠', 'verified')"
                )
            )
            command.upgrade(config, "head")

        path = "/api/corporations/legacy"
        earliest_known = client.get(path, params={"as_of": "2025-05-02"})
        unknown = client.get(path, params={"as_of": "2025-05-01"})

        assert earliest_known.status_code == 200
        assert earliest_known.json() == client.get(path).json()
        assert (unknown.status_code, unknown.json()["code"]) == (
            404,
            "CORPORATION_HISTORY_NOT_FOUND",
        )
        assert client.get(f"{path}/history").json()[0]["kind"] == "legacy"
        legacy_relation = client.get("/api/corporate-relations/legacy-relation")
        assert legacy_relation.status_code == 200
        assert legacy_relation.json()["source_corporation_id"] == "legacy"


def test_corporation_valid_to_registration_update_clear_and_correction(
    client: TestClient,
) -> None:
    # 1. 有効終了日付きで登録でき、valid_to <= valid_from は 422 となる。
    invalid_create = client.post(
        "/api/corporations",
        json={
            "category": "corporation",
            "name": "不正期間法人",
            "valid_from": "2025-05-01",
            "valid_to": "2025-05-01",
        },
    )
    assert invalid_create.status_code == 422

    created = client.post(
        "/api/corporations",
        json={
            "category": "corporation",
            "name": "期間限定薬局",
            "valid_from": "2025-01-01",
            "valid_to": "2026-12-31",
            "evidence": "契約期間を確認",
        },
    )
    assert created.status_code == 201
    corp_id = created.json()["id"]
    assert created.json()["valid_from"] == "2025-01-01"
    assert created.json()["valid_to"] == "2026-12-31"

    # 2. valid_to のみの更新、および null 指定による終了未定への解除ができる。
    extended = client.patch(
        f"/api/corporations/{corp_id}",
        json={"valid_from": "2025-01-01", "valid_to": "2027-03-31"},
    )
    assert extended.status_code == 200
    assert extended.json()["valid_to"] == "2027-03-31"

    cleared = client.patch(
        f"/api/corporations/{corp_id}",
        json={"valid_from": "2025-01-01", "valid_to": None},
    )
    assert cleared.status_code == 200
    assert cleared.json()["valid_to"] is None

    # 3. 履歴訂正で valid_from のみ、および valid_from / valid_to を訂正できる。
    start_only = client.patch(
        f"/api/corporations/{corp_id}/history",
        json={
            "as_of": "2025-06-01",
            "valid_from": "2025-01-15",
            "evidence": "開始日のみ訂正",
        },
    )
    assert start_only.status_code == 200
    assert start_only.json()["valid_from"] == "2025-01-15"

    corrected = client.patch(
        f"/api/corporations/{corp_id}/history",
        json={
            "as_of": "2025-06-01",
            "valid_from": "2025-02-01",
            "valid_to": "2026-06-30",
            "evidence": "期間訂正",
        },
    )
    assert corrected.status_code == 200
    assert corrected.json()["valid_from"] == "2025-02-01"
    assert corrected.json()["valid_to"] == "2026-06-30"
    assert corrected.json()["recorded_by"] == "vendor-admin-1"
    history = client.get(f"/api/corporations/{corp_id}/history").json()
    assert [item["recorded_by"] for item in history] == [
        "vendor-admin-1",
        "vendor-admin-1",
        "vendor-admin-1",
        "vendor-admin-1",
        "vendor-admin-1",
    ]


def test_backdated_update_returns_current_state_period(client: TestClient) -> None:
    created = client.post(
        "/api/corporations",
        json={
            "category": "corporation",
            "name": "当初法人",
            "valid_from": "2025-01-01",
        },
    )
    assert created.status_code == 201
    corp_id = created.json()["id"]

    future_renamed = client.patch(
        f"/api/corporations/{corp_id}",
        json={"name": "現在法人", "valid_from": "2025-03-01"},
    )
    assert future_renamed.status_code == 200

    backdated = client.patch(
        f"/api/corporations/{corp_id}",
        json={"name": "中間法人", "valid_from": "2025-02-01"},
    )
    assert backdated.status_code == 200
    assert backdated.json()["name"] == "現在法人"
    assert backdated.json()["valid_from"] == "2025-03-01"
    assert backdated.json()["valid_to"] is None
