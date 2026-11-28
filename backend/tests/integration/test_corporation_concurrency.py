import sqlite3
from collections.abc import Callable, Iterator
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from pathlib import Path
from threading import Event

import pytest
from fastapi.testclient import TestClient
from httpx import Response
from sqlalchemy import Connection, Engine, event, update

from app.application.auth.contracts import AuthPrincipal
from app.infrastructure.config import Settings
from app.infrastructure.persistence.database import corporations_table, metadata
from app.infrastructure.persistence.unit_of_work import SqlAlchemyCorporationUnitOfWork
from app.main import APP_ENGINE_RESOURCE_NAME, create_app
from app.presentation.dependencies import get_current_auth_principal


def _vendor_principal() -> AuthPrincipal:
    return AuthPrincipal(
        user_id="vendor-admin-1",
        email="admin@vendor.example.com",
        display_name="システム管理者",
        scope_type="vendor",
        tenant_id=None,
        roles=("vendor_admin",),
    )


@contextmanager
def _initialized_corporation_api(database_path: str) -> Iterator[tuple[TestClient, Engine]]:
    app = create_app(Settings(database_path=database_path))
    app.dependency_overrides[get_current_auth_principal] = _vendor_principal
    with TestClient(
        app,
        raise_server_exceptions=False,
        headers={"X-Requested-With": "XMLHttpRequest"},
    ) as client:
        engine = app.state.resources.require(APP_ENGINE_RESOURCE_NAME, Engine)
        metadata.create_all(engine)
        yield client, engine


@pytest.fixture
def corporation_api(tmp_path: Path) -> Iterator[tuple[TestClient, Engine]]:
    with _initialized_corporation_api(str(tmp_path / "corporations.db")) as api:
        yield api


def _overlap_corporation_writes(
    engine: Engine,
    first_request: Callable[[], Response],
    second_request: Callable[[], Response],
    monkeypatch: pytest.MonkeyPatch,
) -> tuple[Response, Response]:
    first_write_pending = Event()
    second_write_attempted = Event()
    commit = SqlAlchemyCorporationUnitOfWork.commit

    def commit_after_second_request(uow: SqlAlchemyCorporationUnitOfWork) -> None:
        if not first_write_pending.is_set():
            first_write_pending.set()
            assert second_write_attempted.wait(timeout=5)
        commit(uow)

    def observe_write_attempt(
        _connection: Connection, _cursor: object, statement: str, *_event_args: object
    ) -> None:
        # 遅延トランザクションでは、後続のリクエストが読み取りを終えてから書き込む。
        if first_write_pending.is_set() and statement.startswith(
            ("BEGIN IMMEDIATE", "INSERT INTO corporations", "UPDATE corporations")
        ):
            second_write_attempted.set()

    monkeypatch.setattr(SqlAlchemyCorporationUnitOfWork, "commit", commit_after_second_request)
    event.listen(engine, "before_cursor_execute", observe_write_attempt)
    try:
        with ThreadPoolExecutor(max_workers=2) as workers:
            first = workers.submit(first_request)
            assert first_write_pending.wait(timeout=5)
            second = workers.submit(second_request)
            return first.result(timeout=10), second.result(timeout=10)
    finally:
        event.remove(engine, "before_cursor_execute", observe_write_attempt)


def test_concurrent_registration_reports_duplicate_corporate_number(
    corporation_api: tuple[TestClient, Engine], monkeypatch: pytest.MonkeyPatch
) -> None:
    client, engine = corporation_api
    payload = {
        "category": "corporation",
        "name": "法人",
        "representative_name": "法人代表",
        "corporate_number": "1234567890123",
    }

    first, second = _overlap_corporation_writes(
        engine,
        lambda: client.post("/api/corporations", json=payload),
        lambda: client.post("/api/corporations", json=payload),
        monkeypatch,
    )

    assert first.status_code == 201
    assert second.status_code == 409
    assert second.json()["code"] == "DUPLICATE_CORPORATE_NUMBER"
    assert client.get("/api/corporations").json()["total"] == 1


def test_concurrent_profile_update_checks_committed_status(
    corporation_api: tuple[TestClient, Engine], monkeypatch: pytest.MonkeyPatch
) -> None:
    client, engine = corporation_api
    created = client.post(
        "/api/corporations",
        json={"category": "corporation", "name": "法人", "representative_name": "法人代表"},
    )
    assert created.status_code == 201
    corporation_path = f"/api/corporations/{created.json()['id']}"

    dissolved, renamed = _overlap_corporation_writes(
        engine,
        lambda: client.patch(f"{corporation_path}/status", json={"status": "dissolved"}),
        lambda: client.patch(corporation_path, json={"name": "変更後"}),
        monkeypatch,
    )

    assert dissolved.status_code == 200
    assert renamed.status_code == 400
    assert renamed.json()["code"] == "INVALID_UPDATE"
    saved = client.get(corporation_path).json()
    assert saved["status"] == "dissolved"
    assert saved["name"] == "法人"
    history = client.get(f"{corporation_path}/history").json()
    assert [record["kind"] for record in history] == ["registration", "dissolution"]


def test_status_change_reports_conflict_when_write_lock_wait_expires(
    corporation_api: tuple[TestClient, Engine],
) -> None:
    client, engine = corporation_api
    created = client.post(
        "/api/corporations",
        json={"category": "corporation", "name": "法人", "representative_name": "法人代表"},
    )
    assert created.status_code == 201
    corporation_id = created.json()["id"]
    corporation_path = f"/api/corporations/{corporation_id}"

    @event.listens_for(engine, "checkout")
    def disable_lock_wait(connection: sqlite3.Connection, *_event_args: object) -> None:
        connection.execute("PRAGMA busy_timeout=0")

    with engine.begin() as connection:
        connection.execute(
            update(corporations_table)
            .where(corporations_table.c.id == corporation_id)
            .values(name="同時更新")
        )
        response = client.patch(f"{corporation_path}/status", json={"status": "dissolved"})

    assert response.status_code == 409
    assert response.json()["code"] == "CORPORATION_CONFLICT"
    assert client.get(corporation_path).json()["status"] == "active"


def test_memory_database_preserves_pending_write_during_concurrent_update(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    with _initialized_corporation_api(":memory:") as (client, engine):
        created = client.post(
            "/api/corporations",
            json={"category": "corporation", "name": "法人", "representative_name": "法人代表"},
        )
        assert created.status_code == 201
        corporation_id = created.json()["id"]
        corporation_path = f"/api/corporations/{corporation_id}"
        request_entered = Event()
        enter = SqlAlchemyCorporationUnitOfWork.__enter__

        def observe_competing_command(
            uow: SqlAlchemyCorporationUnitOfWork,
        ) -> SqlAlchemyCorporationUnitOfWork:
            request_entered.set()
            return enter(uow)

        monkeypatch.setattr(SqlAlchemyCorporationUnitOfWork, "__enter__", observe_competing_command)

        with ThreadPoolExecutor(max_workers=1) as worker, engine.begin() as connection:
            connection.execute(
                update(corporations_table)
                .where(corporations_table.c.id == corporation_id)
                .values(name="変更後の法人")
            )
            competing = worker.submit(client.patch, corporation_path, json={"address": "東京都"})
            assert request_entered.wait(timeout=5)
            with pytest.raises(TimeoutError):
                competing.result(timeout=0.25)

        assert competing.result(timeout=5).status_code == 200
        saved = client.get(corporation_path).json()
        assert saved["name"] == "変更後の法人"
        assert saved["address"] == "東京都"
