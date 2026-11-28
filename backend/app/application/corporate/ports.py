"""法人ユースケースが所有する Outbound Port 定義。"""

from datetime import date
from types import TracebackType
from typing import Protocol

from app.application.corporate.contracts import (
    CorporationItem,
    CorporationListResult,
    ListCorporationsQuery,
)
from app.domain.corporate.entities import CorporateRelation
from app.domain.corporate.history import CorporationHistoryRecord
from app.domain.corporate.identifiers import CorporateRelationId, CorporationId
from app.domain.corporate.repositories import CorporateRelationRepository, CorporationRepository
from app.domain.corporate.value_objects import CorporateRelationType
from app.domain.foundation.primitives import AwareDatetime


class CorporationUnitOfWork(Protocol):
    """法人更新の原子性境界を表す Unit of Work 契約。"""

    @property
    def corporations(self) -> CorporationRepository:
        """同一トランザクション内の法人集約リポジトリを返す。"""
        ...

    def __enter__(self) -> CorporationUnitOfWork:
        """トランザクションスコープを開始する。"""
        ...

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: TracebackType | None,
    ) -> None:
        """未確定の変更を破棄して資源を解放する。"""
        ...

    def commit(self) -> None:
        """変更を確定する。"""
        ...

    def rollback(self) -> None:
        """変更を破棄する。"""
        ...


class CorporationUnitOfWorkFactory(Protocol):
    """操作ごとに独立した Unit of Work を生成するファクトリ。"""

    def __call__(self) -> CorporationUnitOfWork:
        """新しい Unit of Work を返す。"""
        ...


class CorporationQueryGateway(Protocol):
    """法人の参照・検索を担う永続化クエリポート。"""

    def get_corporation(self, corporation_id: str) -> CorporationItem | None:
        """ID に一致する法人投影を返す。"""
        ...

    def list_corporations(self, query: ListCorporationsQuery) -> CorporationListResult:
        """条件に一致する法人投影一覧を返す。"""
        ...

    def get_history(
        self, corporation_id: CorporationId
    ) -> tuple[CorporationHistoryRecord, ...] | None:
        """法人が存在すれば変更履歴、存在しなければ None を返す。"""
        ...


class CorporateRelationUnitOfWork(CorporationUnitOfWork, Protocol):
    """法人の存在確認と関係の検証・変更を同じ書き込み境界に置く。"""

    @property
    def relations(self) -> CorporateRelationRepository:
        """同一トランザクションに属する法人間関係リポジトリを返す。"""
        ...

    def __enter__(self) -> CorporateRelationUnitOfWork:
        """DB の書き込み権を取得して操作を開始する。"""
        ...


class CorporateRelationUnitOfWorkFactory(Protocol):
    """書き込み操作ごとに法人間関係のトランザクションを生成する。"""

    def __call__(self) -> CorporateRelationUnitOfWork:
        """新しい Unit of Work を返す。"""
        ...


class CorporateRelationQueryGateway(Protocol):
    """読み取り側の法人間関係の取得条件を定義する。"""

    def get(self, relation_id: CorporateRelationId) -> CorporateRelation | None:
        """関係と記録履歴を取得する。"""
        ...

    def list_relations(
        self,
        corporation_id: CorporationId | None,
        as_of: date | None,
        recorded_as_of: AwareDatetime | None,
        relation_type: CorporateRelationType | None = None,
    ) -> tuple[CorporateRelation, ...]:
        """有効日・記録日時・関係する法人・種別で絞り込む。"""
        ...
