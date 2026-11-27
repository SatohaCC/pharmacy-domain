"""法人間関係の API、Alembic の移行、並行時の制約を検証する。"""

from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Event

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from httpx import Response
from sqlalchemy import Connection, Engine, event, text

from app.application.auth.contracts import AuthPrincipal
from app.infrastructure.config import Settings
from app.infrastructure.persistence.unit_of_work import SqlAlchemyCorporationUnitOfWork
from app.main import APP_ENGINE_RESOURCE_NAME, create_app
from app.presentation.dependencies import get_current_auth_principal

_RELATIONS = "/api/corporate-relations"


def _vendor_principal() -> AuthPrincipal:
    return AuthPrincipal(
        user_id="vendor-admin-1",
        email="admin@vendor.example.com",
        display_name="システム管理者",
        scope_type="vendor",
        tenant_id=None,
        roles=("vendor_admin",),
    )


def _create_corporation(client: TestClient, name: str, category: str = "corporation") -> str:
    response = client.post("/api/corporations", json={"category": category, "name": name})
    assert response.status_code == 201, response.text
    return str(response.json()["id"])


def _register(client: TestClient, source: str, target: str, kind: str = "parent_child") -> Response:
    return client.post(
        _RELATIONS,
        json={
            "source_corporation_id": source,
            "target_corporation_id": target,
            "relation_type": kind,
            "valid_from": "2026-01-01",
            "evidence": "契約書を確認",
        },
    )


@pytest.fixture
def relations_api(tmp_path: Path) -> Iterator[tuple[TestClient, Engine, str]]:
    app = create_app(Settings(database_path=str(tmp_path / "relations.sqlite3")))
    app.dependency_overrides[get_current_auth_principal] = _vendor_principal
    config = Config(str(Path(__file__).resolve().parents[2] / "alembic.ini"))
    with TestClient(app, headers={"X-Requested-With": "XMLHttpRequest"}) as client:
        engine = app.state.resources.require(APP_ENGINE_RESOURCE_NAME, Engine)
        with engine.begin() as connection:
            config.attributes["connection"] = connection
            command.upgrade(config, "0001_create_corporations")
            connection.execute(
                text(
                    "INSERT INTO corporations "
                    "(id, category, name, address, status, created_at, updated_at) "
                    "VALUES ('legacy', 'corporation', '移行前の法人', '', 'active', "
                    "'2025-01-01T00:00:00+00:00', '2025-01-01T00:00:00+00:00')"
                )
            )
        with engine.begin() as connection:
            config.attributes["connection"] = connection
            command.upgrade(config, "head")
        yield client, engine, "legacy"


def test_revision_history_and_business_date_filters_survive_migration(
    relations_api: tuple[TestClient, Engine, str],
) -> None:
    client, _engine, parent = relations_api
    child = _create_corporation(client, "個人開設者", "individual")
    created = _register(client, parent, child)
    assert created.status_code == 201, created.text
    initial = created.json()
    path = f"{_RELATIONS}/{initial['id']}"

    corrected = client.patch(
        path,
        json={
            "evidence": "原契約を確認",
            "confirmation_status": "verified",
            "valid_from": "2026-01-02",
        },
    )
    ended = client.post(f"{path}/end", json={"valid_to": "2026-02-01"})
    prior = client.get(path, params={"recorded_as_of": initial["recorded_at"]})
    history = client.get(f"{path}/history")
    before_end = client.get(_RELATIONS, params={"corporation_id": child, "as_of": "2026-01-31"})
    after_end = client.get(_RELATIONS, params={"corporation_id": parent, "as_of": "2026-02-01"})
    previously_known = client.get(
        _RELATIONS,
        params={"as_of": "2026-02-01", "recorded_as_of": initial["recorded_at"]},
    )

    assert corrected.status_code == ended.status_code == 200
    assert prior.json() == initial
    assert [record["evidence"] for record in history.json()] == [
        "契約書を確認",
        "原契約を確認",
        "原契約を確認",
    ]
    assert [record["valid_to"] for record in history.json()] == [None, None, "2026-02-01"]
    assert [record["valid_from"] for record in history.json()] == [
        "2026-01-01",
        "2026-01-02",
        "2026-01-02",
    ]
    assert history.json()[-1]["confirmation_status"] == "verified"
    assert [record["recorded_by"] for record in history.json()] == [
        "vendor-admin-1",
        "vendor-admin-1",
        "vendor-admin-1",
    ]
    assert before_end.json()["items"][0]["id"] == initial["id"]
    assert after_end.json() == {"items": [], "total": 0}
    assert previously_known.json()["items"] == [initial]
    assert client.delete(path).status_code == 405
    assert client.get(path).json()["valid_to"] == "2026-02-01"


def test_api_rejects_missing_self_and_invalid_corrections(
    relations_api: tuple[TestClient, Engine, str],
) -> None:
    client, _engine, parent = relations_api
    child = _create_corporation(client, "子法人")
    created = _register(client, parent, child)
    assert created.status_code == 201
    path = f"{_RELATIONS}/{created.json()['id']}"

    missing = _register(client, parent, "missing-id")
    self_reference = _register(client, parent, parent)
    shorter = client.patch(path, json={"valid_to": "2026-01-01"})
    null_start = client.patch(path, json={"valid_from": None})
    illegal_kind = client.patch(path, json={"relation_type": "affiliate"})
    unknown_relation = client.get(f"{_RELATIONS}/missing-id")
    overflowing = {"recorded_as_of": "0001-01-01T00:00:00+01:00"}

    assert (missing.status_code, missing.json()["code"]) == (404, "CORPORATION_NOT_FOUND")
    assert (self_reference.status_code, self_reference.json()["code"]) == (
        422,
        "SELF_CORPORATE_RELATION",
    )
    assert shorter.status_code == null_start.status_code == illegal_kind.status_code == 422
    assert (unknown_relation.status_code, unknown_relation.json()["code"]) == (
        404,
        "CORPORATE_RELATION_NOT_FOUND",
    )
    assert len(client.get(f"{path}/history").json()) == 1
    assert client.get(path, params=overflowing).status_code == 422
    assert client.get(_RELATIONS, params=overflowing).status_code == 422


def test_reopening_an_ended_relation_checks_the_new_parent(
    relations_api: tuple[TestClient, Engine, str],
) -> None:
    client, _engine, parent = relations_api
    child = _create_corporation(client, "子法人")
    successor = _create_corporation(client, "後継の親法人")
    created = _register(client, parent, child)
    assert created.status_code == 201
    path = f"{_RELATIONS}/{created.json()['id']}"
    assert client.post(f"{path}/end", json={"valid_to": "2026-02-01"}).status_code == 200
    next_parent = client.post(
        _RELATIONS,
        json={
            "source_corporation_id": successor,
            "target_corporation_id": child,
            "relation_type": "parent_child",
            "valid_from": "2026-02-01",
            "evidence": "株式譲渡",
        },
    )
    assert next_parent.status_code == 201, next_parent.text

    correction = client.patch(path, json={"valid_to": None})

    assert (correction.status_code, correction.json()["code"]) == (
        409,
        "MULTIPLE_CORPORATE_PARENTS",
    )
    assert client.get(path).json()["valid_to"] == "2026-02-01"
    assert len(client.get(f"{path}/history").json()) == 2


@pytest.mark.parametrize(
    ("scenario", "error_code"),
    [("extra_parent", "MULTIPLE_CORPORATE_PARENTS"), ("cycle", "CORPORATE_RELATION_CYCLE")],
)
def test_concurrent_registration_validates_committed_relation_before_writing(
    relations_api: tuple[TestClient, Engine, str],
    monkeypatch: pytest.MonkeyPatch,
    scenario: str,
    error_code: str,
) -> None:
    client, engine, first_parent = relations_api
    child = _create_corporation(client, "子法人")
    backup_parent = _create_corporation(client, "別の親")
    conflicting_edge = (
        (backup_parent, child) if scenario == "extra_parent" else (child, first_parent)
    )
    first_pending = Event()
    second_attempted = Event()
    commit = SqlAlchemyCorporationUnitOfWork.commit

    def commit_after_second_attempt(uow: SqlAlchemyCorporationUnitOfWork) -> None:
        if not first_pending.is_set():
            first_pending.set()
            assert second_attempted.wait(timeout=5)
        commit(uow)

    def observe_write(
        _connection: Connection, _cursor: object, statement: str, *_event_args: object
    ) -> None:
        if first_pending.is_set() and statement.startswith(
            ("BEGIN IMMEDIATE", "INSERT INTO corporate_relations")
        ):
            second_attempted.set()

    monkeypatch.setattr(SqlAlchemyCorporationUnitOfWork, "commit", commit_after_second_attempt)
    event.listen(engine, "before_cursor_execute", observe_write)
    try:
        with ThreadPoolExecutor(max_workers=2) as workers:
            first = workers.submit(_register, client, first_parent, child)
            assert first_pending.wait(timeout=5)
            second = workers.submit(_register, client, *conflicting_edge)
            saved, rejected = first.result(timeout=10), second.result(timeout=10)
    finally:
        event.remove(engine, "before_cursor_execute", observe_write)

    assert saved.status_code == 201
    assert (rejected.status_code, rejected.json()["code"]) == (409, error_code)
    assert client.get(_RELATIONS).json()["total"] == 1
