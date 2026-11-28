"""法人間関係の有効日時と記録時点を SQLite から復元する。"""

from dataclasses import replace
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

from sqlalchemy import insert

from app.domain.corporate import (
    CorporateRelation,
    CorporateRelationId,
    CorporateRelationRevision,
    CorporateRelationType,
    CorporationEvidence,
    CorporationId,
)
from app.domain.foundation import AwareDatetime, EffectiveDateRange
from app.infrastructure.persistence.corporate_relation_query import (
    SqlAlchemyCorporateRelationQueryPort,
)
from app.infrastructure.persistence.corporate_relation_repository import (
    SqlAlchemyCorporateRelationRepository,
)
from app.infrastructure.persistence.database import corporations_table, create_app_engine, metadata


def test_revisions_are_read_from_a_new_engine_after_commit(tmp_path: Path) -> None:
    database_path = str(tmp_path / "relations.db")
    timestamp = datetime(2026, 1, 1, tzinfo=UTC)
    start = date(2025, 1, 1)
    end = date(2025, 2, 1)
    original = CorporateRelation(
        CorporateRelationId("relation"),
        CorporationId("a"),
        CorporationId("b"),
        CorporateRelationType.FC_VC,
        (
            CorporateRelationRevision(
                EffectiveDateRange(start),
                CorporationEvidence("契約書"),
                AwareDatetime(timestamp),
            ),
        ),
    )
    ended = original.end(end_date=end, recorded_at=AwareDatetime(timestamp + timedelta(seconds=1)))
    engine = create_app_engine(database_path)
    try:
        metadata.create_all(engine)
        with engine.begin() as connection:
            for identifier in ("a", "b"):
                connection.execute(
                    insert(corporations_table).values(
                        id=identifier,
                        category="corporation",
                        name=identifier,
                        address="",
                        status="active",
                        created_at=timestamp.isoformat(),
                        updated_at=timestamp.isoformat(),
                    )
                )
            repository = SqlAlchemyCorporateRelationRepository(connection)
            repository.add(original)
            repository.save(ended)
    finally:
        engine.dispose()

    reader = create_app_engine(database_path)
    try:
        queries = SqlAlchemyCorporateRelationQueryPort(reader)
        saved = queries.get(original.id)
        old_view = queries.list_relations(CorporationId("b"), end, AwareDatetime(timestamp))
        new_view = queries.list_relations(CorporationId("b"), end, None)
    finally:
        reader.dispose()

    assert saved == ended
    assert old_view == (replace(ended, revisions=original.revisions),)
    assert new_view == ()
