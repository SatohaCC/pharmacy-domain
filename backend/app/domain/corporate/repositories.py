"""法人集約のリポジトリ抽象。"""

from typing import Protocol

from app.domain.corporate.entities import Corporation
from app.domain.corporate.identifiers import CorporationId
from app.domain.corporate.primitives import CorporateNumber


class CorporationRepository(Protocol):
    """法人集約の永続化契約。過去の業務記録参照保全のため物理削除は持たない。"""

    def add(self, corporation: Corporation) -> None:
        """新規法人を追加する。"""
        ...

    def get(self, corporation_id: CorporationId) -> Corporation | None:
        """ID に一致する法人を取得する。存在しない場合は None を返す。"""
        ...

    def exists_by_corporate_number(
        self,
        corporate_number: CorporateNumber,
        *,
        exclude_id: CorporationId | None = None,
    ) -> bool:
        """同じ 13 桁法人番号を持つ法人が既に存在するかを返す。"""
        ...

    def save(self, corporation: Corporation) -> None:
        """既存法人の変更を保存する。"""
        ...
