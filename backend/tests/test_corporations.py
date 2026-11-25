import sqlite3
from contextlib import closing
from datetime import UTC, datetime
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient

from app.application.corporate.contracts import ListCorporationsQuery
from app.domain.corporate import (
    CorporateAddress,
    CorporateNumber,
    Corporation,
    CorporationCategory,
    CorporationId,
    CorporationName,
    CorporationNotFoundError,
    CorporationStatus,
    DuplicateCorporateNumberError,
)
from app.domain.foundation import AwareDatetime, DomainConflictError
from app.infrastructure.config import Settings
from app.infrastructure.persistence import (
    SqlAlchemyCorporationQueryPort,
    SqlAlchemyCorporationUnitOfWorkFactory,
    create_app_engine,
    database,
    metadata,
)
from app.main import create_app

_ALEMBIC_INI = Path(__file__).resolve().parents[1] / "alembic.ini"


def test_wal_initialization_retries_when_another_connection_holds_a_write_lock(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    database_path = tmp_path / "concurrent.db"
    with (
        closing(sqlite3.connect(database_path)) as writer,
        closing(sqlite3.connect(database_path, timeout=0)) as startup,
    ):
        writer.execute("BEGIN IMMEDIATE")
        monkeypatch.setattr(database, "sleep", lambda _seconds: writer.rollback())

        database._enable_wal(startup)

        assert not writer.in_transaction
        assert startup.execute("PRAGMA journal_mode").fetchone() == ("wal",)


def test_sqlalchemy_corporation_persistence_and_unicode_search(tmp_path: Path) -> None:
    db_path = tmp_path / "persist" / "corporations.db"
    t1 = AwareDatetime(datetime(2026, 11, 21, 9, 0, tzinfo=UTC))
    t2 = AwareDatetime(datetime(2026, 11, 21, 9, 5, tzinfo=UTC))

    engine = create_app_engine(str(db_path))
    metadata.create_all(engine)
    uow_factory = SqlAlchemyCorporationUnitOfWorkFactory(engine)

    try:
        with uow_factory() as uow:
            uow.corporations.add(
                Corporation(
                    id=CorporationId("c-1"),
                    category=CorporationCategory.CORPORATION,
                    name=CorporationName("株式会社Über薬局"),
                    corporate_number=CorporateNumber("1234567890123"),
                    address=CorporateAddress("東京都千代田区"),
                    status=CorporationStatus.ACTIVE,
                    created_at=t1,
                    updated_at=t1,
                )
            )
            uow.corporations.add(
                Corporation(
                    id=CorporationId("c-2"),
                    category=CorporationCategory.INDIVIDUAL,
                    name=CorporationName("佐藤薬局"),
                    corporate_number=None,
                    address=CorporateAddress("大阪府大阪市"),
                    status=CorporationStatus.ACTIVE,
                    created_at=t2,
                    updated_at=t2,
                )
            )
            uow.commit()
    finally:
        engine.dispose()

    reopened_engine = create_app_engine(str(db_path))
    query_port = SqlAlchemyCorporationQueryPort(reopened_engine)
    try:
        all_items = query_port.list_corporations(ListCorporationsQuery()).items
        assert [item.id for item in all_items] == ["c-2", "c-1"]

        assert [
            item.id
            for item in query_port.list_corporations(
                ListCorporationsQuery(category="individual")
            ).items
        ] == ["c-2"]
        assert [
            item.id
            for item in query_port.list_corporations(ListCorporationsQuery(query="über")).items
        ] == ["c-1"]
        assert [
            item.id
            for item in query_port.list_corporations(
                ListCorporationsQuery(query="1234567890123")
            ).items
        ] == ["c-1"]
    finally:
        reopened_engine.dispose()


def test_corporations_api_crud_and_validation_flow(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    db_path = tmp_path / "api.db"
    monkeypatch.setenv("DATABASE_PATH", str(db_path))
    command.upgrade(Config(str(_ALEMBIC_INI)), "head")
    app = create_app(Settings(database_path=str(db_path)))

    with TestClient(app) as client:
        full_width_number = "１２３４５６７８９０１２３"
        invalid_number_create = client.post(
            "/api/corporations",
            json={
                "category": "corporation",
                "name": "法人番号の検証",
                "corporate_number": full_width_number,
            },
        )
        assert invalid_number_create.status_code == 422
        assert invalid_number_create.json()["code"] == "VALIDATION_ERROR"

        # 不正な空白名は 422。
        invalid_create = client.post(
            "/api/corporations",
            json={"category": "corporation", "name": "   "},
        )
        assert invalid_create.status_code == 422
        assert invalid_create.json()["code"] == "VALIDATION_ERROR"

        # 個人区分への法人番号指定は 422。
        invalid_individual = client.post(
            "/api/corporations",
            json={
                "category": "individual",
                "name": "山田太郎",
                "corporate_number": "1234567890123",
            },
        )
        assert invalid_individual.status_code == 422

        # 法人登録。
        created_res = client.post(
            "/api/corporations",
            json={
                "category": "corporation",
                "name": "株式会社さくら薬局",
                "corporate_number": "1234567890123",
                "address": "東京都新宿区1-2-3",
            },
        )
        assert created_res.status_code == 201
        created = created_res.json()
        corp_id = created["id"]
        assert created["category"] == "corporation"
        assert created["status"] == "active"

        invalid_number_patch = client.patch(
            f"/api/corporations/{corp_id}", json={"corporate_number": full_width_number}
        )
        assert invalid_number_patch.status_code == 422
        assert invalid_number_patch.json()["code"] == "VALIDATION_ERROR"

        # 同じ法人番号の重複登録は 409。
        dup_res = client.post(
            "/api/corporations",
            json={
                "category": "corporation",
                "name": "別名法人",
                "corporate_number": "1234567890123",
            },
        )
        assert dup_res.status_code == 409
        assert dup_res.json()["code"] == "DUPLICATE_CORPORATE_NUMBER"

        # 一覧・詳細取得。
        list_res = client.get("/api/corporations", params={"q": "さくら"})
        assert list_res.status_code == 200
        assert list_res.json()["total"] == 1

        get_res = client.get(f"/api/corporations/{corp_id}")
        assert get_res.status_code == 200
        assert get_res.json()["name"] == "株式会社さくら薬局"
        assert get_res.json()["corporate_number"] == "1234567890123"

        # 空の PATCH は 400。
        empty_patch = client.patch(f"/api/corporations/{corp_id}", json={})
        assert empty_patch.status_code == 400
        assert empty_patch.json()["code"] == "EMPTY_UPDATE"

        # name に null は 400。
        null_patch = client.patch(f"/api/corporations/{corp_id}", json={"name": None})
        assert null_patch.status_code == 400
        assert null_patch.json()["code"] == "INVALID_UPDATE"

        # 基本情報更新（自法人番号維持・所在地空文字クリア・address=null 拒否）。
        patch_res = client.patch(
            f"/api/corporations/{corp_id}",
            json={"address": "東京都渋谷区4-5-6", "corporate_number": "1234567890123"},
        )
        assert patch_res.status_code == 200
        assert patch_res.json()["address"] == "東京都渋谷区4-5-6"
        assert patch_res.json()["corporate_number"] == "1234567890123"

        clear_addr_res = client.patch(f"/api/corporations/{corp_id}", json={"address": ""})
        assert clear_addr_res.status_code == 200
        assert clear_addr_res.json()["address"] == ""

        null_addr_res = client.patch(f"/api/corporations/{corp_id}", json={"address": None})
        assert null_addr_res.status_code == 400
        assert null_addr_res.json()["code"] == "INVALID_UPDATE"

        # corporate_number=null で法人番号をクリアできる。
        clear_num_res = client.patch(
            f"/api/corporations/{corp_id}",
            json={"corporate_number": None},
        )
        assert clear_num_res.status_code == 200
        assert clear_num_res.json()["corporate_number"] is None

        # 別法人が使用中の法人番号への更新は 409。
        other_res = client.post(
            "/api/corporations",
            json={
                "category": "corporation",
                "name": "株式会社別法人",
                "corporate_number": "9999999999999",
            },
        )
        assert other_res.status_code == 201
        dup_patch_res = client.patch(
            f"/api/corporations/{corp_id}",
            json={"corporate_number": "9999999999999"},
        )
        assert dup_patch_res.status_code == 409
        assert dup_patch_res.json()["code"] == "DUPLICATE_CORPORATE_NUMBER"

        # 存続状態変更（合併消滅）。
        status_res = client.patch(
            f"/api/corporations/{corp_id}/status",
            json={"status": "merged_out"},
        )
        assert status_res.status_code == 200
        assert status_res.json()["status"] == "merged_out"

        # 合併消滅後の基本情報更新・再遷移は 400。
        update_after_merge = client.patch(
            f"/api/corporations/{corp_id}",
            json={"name": "消滅後変更"},
        )
        assert update_after_merge.status_code == 400
        assert update_after_merge.json()["code"] == "INVALID_UPDATE"

        re_transition = client.patch(
            f"/api/corporations/{corp_id}/status",
            json={"status": "active"},
        )
        assert re_transition.status_code == 400
        assert re_transition.json()["code"] == "INVALID_CORPORATION_TRANSITION"


def test_sqlalchemy_repository_translates_constraints_and_rolls_back(tmp_path: Path) -> None:
    db_path = tmp_path / "constraints.db"
    now = AwareDatetime(datetime(2026, 11, 21, 9, 0, tzinfo=UTC))

    engine = create_app_engine(str(db_path))
    metadata.create_all(engine)
    uow_factory = SqlAlchemyCorporationUnitOfWorkFactory(engine)

    try:
        with uow_factory() as uow:
            uow.corporations.add(
                Corporation(
                    id=CorporationId("c-1"),
                    category=CorporationCategory.CORPORATION,
                    name=CorporationName("法人1"),
                    corporate_number=CorporateNumber("1111111111111"),
                    address=CorporateAddress(""),
                    status=CorporationStatus.ACTIVE,
                    created_at=now,
                    updated_at=now,
                )
            )
            uow.commit()

        # 同一 UoW 内で別の法人追加後に法人番号一意制約が発火すると、全体がロールバックされる。
        with pytest.raises(DuplicateCorporateNumberError), uow_factory() as uow:
            uow.corporations.add(
                Corporation(
                    id=CorporationId("c-temp"),
                    category=CorporationCategory.INDIVIDUAL,
                    name=CorporationName("ロールバック対象"),
                    corporate_number=None,
                    address=CorporateAddress(""),
                    status=CorporationStatus.ACTIVE,
                    created_at=now,
                    updated_at=now,
                )
            )
            uow.corporations.add(
                Corporation(
                    id=CorporationId("c-2"),
                    category=CorporationCategory.CORPORATION,
                    name=CorporationName("重複法人"),
                    corporate_number=CorporateNumber("1111111111111"),
                    address=CorporateAddress(""),
                    status=CorporationStatus.ACTIVE,
                    created_at=now,
                    updated_at=now,
                )
            )

        with uow_factory() as uow:
            assert uow.corporations.get(CorporationId("c-temp")) is None

        # 主キー重複は DomainConflictError に変換される。
        with pytest.raises(DomainConflictError), uow_factory() as uow:
            uow.corporations.add(
                Corporation(
                    id=CorporationId("c-1"),
                    category=CorporationCategory.INDIVIDUAL,
                    name=CorporationName("ID重複"),
                    corporate_number=None,
                    address=CorporateAddress(""),
                    status=CorporationStatus.ACTIVE,
                    created_at=now,
                    updated_at=now,
                )
            )

        # 存在しない ID に対する save は CorporationNotFoundError を送出する。
        with pytest.raises(CorporationNotFoundError), uow_factory() as uow:
            uow.corporations.save(
                Corporation(
                    id=CorporationId("missing-id"),
                    category=CorporationCategory.INDIVIDUAL,
                    name=CorporationName("未登録"),
                    corporate_number=None,
                    address=CorporateAddress(""),
                    status=CorporationStatus.ACTIVE,
                    created_at=now,
                    updated_at=now,
                )
            )
    finally:
        engine.dispose()
