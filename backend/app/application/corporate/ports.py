"""法人ユースケースが所有する Outbound Port 定義。"""

from types import TracebackType
from typing import Protocol

from app.application.corporate.contracts import (
    CorporationItem,
    CorporationListResult,
    ListCorporationsQuery,
)
from app.domain.corporate.repositories import CorporationRepository


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
