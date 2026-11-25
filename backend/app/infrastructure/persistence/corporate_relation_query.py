"""読み取り専用接続から法人間関係を参照する。"""

from datetime import date

from sqlalchemy import Engine

from app.domain.corporate import CorporateRelation, CorporateRelationId, CorporationId
from app.domain.foundation import AwareDatetime
from app.infrastructure.persistence.corporate_relation_repository import (
    SqlAlchemyCorporateRelationRepository,
)


class SqlAlchemyCorporateRelationQueryPort:
    """読み取り操作ごとに独立した接続を使用する。"""

    def __init__(self, engine: Engine) -> None:
        self._engine = engine

    def get(self, relation_id: CorporateRelationId) -> CorporateRelation | None:
        """法人間関係の全履歴を取得する。"""
        with self._engine.connect() as connection:
            return SqlAlchemyCorporateRelationRepository(connection).get(relation_id)

    def list_relations(
        self,
        corporation_id: CorporationId | None,
        as_of: date | None,
        recorded_as_of: AwareDatetime | None,
    ) -> tuple[CorporateRelation, ...]:
        """両端の法人 ID、有効日および記録日時で絞り込む。"""
        with self._engine.connect() as connection:
            return SqlAlchemyCorporateRelationRepository(connection).list_relations(
                corporation_id, as_of, recorded_as_of
            )
