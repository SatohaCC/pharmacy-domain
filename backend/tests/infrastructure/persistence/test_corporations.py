"""法人コンテキストの永続化（Repository / QueryPort）テスト。"""

from datetime import UTC, datetime
from pathlib import Path

import pytest

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
from app.infrastructure.persistence import (
    SqlAlchemyCorporationQueryPort,
    SqlAlchemyCorporationUnitOfWorkFactory,
    create_app_engine,
    metadata,
)


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


def test_sqlalchemy_repository_maps_empty_representative_name_to_none(tmp_path: Path) -> None:
    db_path = tmp_path / "legacy_rep_name.db"
    now = AwareDatetime(datetime(2026, 11, 21, 9, 0, tzinfo=UTC))

    engine = create_app_engine(str(db_path))
    metadata.create_all(engine)
    uow_factory = SqlAlchemyCorporationUnitOfWorkFactory(engine)

    try:
        with uow_factory() as uow:
            uow.corporations.add(
                Corporation(
                    id=CorporationId("legacy-corp"),
                    category=CorporationCategory.CORPORATION,
                    name=CorporationName("既存法人"),
                    corporate_number=None,
                    address=CorporateAddress(""),
                    status=CorporationStatus.ACTIVE,
                    created_at=now,
                    updated_at=now,
                )
            )
            uow.commit()

        with uow_factory() as uow:
            restored = uow.corporations.get(CorporationId("legacy-corp"))
            assert restored is not None
            assert restored.representative_name is None
    finally:
        engine.dispose()
