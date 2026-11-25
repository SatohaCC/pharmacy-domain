"""法人集約のリポジトリ抽象。"""

from typing import Protocol

from app.domain.corporate.entities import CorporateRelation, Corporation
from app.domain.corporate.identifiers import CorporateRelationId, CorporationId
from app.domain.corporate.primitives import CorporateNumber
from app.domain.foundation.value_objects import EffectiveDateRange


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


class CorporateRelationRepository(Protocol):
    """法人間関係と改訂履歴を永続化する契約。"""

    def add(self, relation: CorporateRelation) -> None:
        """新規の関係と最初の記録を追加する。"""
        ...

    def get(self, relation_id: CorporateRelationId) -> CorporateRelation | None:
        """識別子に一致する関係と改訂履歴を取得する。"""
        ...

    def list_overlapping(self, period: EffectiveDateRange) -> tuple[CorporateRelation, ...]:
        """最新記録の適用期間が指定区間と重複する関係を取得する。"""
        ...

    def save(self, relation: CorporateRelation) -> None:
        """既存の関係の改訂を追記する。"""
        ...
