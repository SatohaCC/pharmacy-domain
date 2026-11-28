"""法人コンテキストの Value Object。"""

from dataclasses import dataclass
from enum import StrEnum
from typing import Self

from app.domain.corporate.primitives import CorporationEvidence
from app.domain.foundation.primitives import AwareDatetime
from app.domain.foundation.value_objects import EffectiveDateRange


class CorporationCategory(StrEnum):
    """法人の区分。個人開設者も同一モデルで管理する。"""

    CORPORATION = "corporation"
    INDIVIDUAL = "individual"


@dataclass(frozen=True, slots=True)
class CorporationStatusRule:
    """法人の存続状態ごとに適用される遷移・更新・利用制限のルール。"""

    is_terminal: bool
    suspends_usage: bool
    allows_profile_update: bool
    allows_usage_activation: bool


class CorporationStatus(StrEnum):
    """法人の存続状態。合併消滅や解散でもレコードは削除せず保持する。"""

    _rule: CorporationStatusRule

    def __new__(cls, value: str, rule: CorporationStatusRule | None = None) -> Self:
        if not isinstance(rule, CorporationStatusRule):
            raise TypeError("CorporationStatus の定義には CorporationStatusRule が必須です。")
        obj = str.__new__(cls, value)
        obj._value_ = value
        obj._rule = rule
        return obj

    ACTIVE = (
        "active",
        CorporationStatusRule(
            is_terminal=False,
            suspends_usage=False,
            allows_profile_update=True,
            allows_usage_activation=True,
        ),
    )
    DISSOLVED = (
        "dissolved",
        CorporationStatusRule(
            is_terminal=True,
            suspends_usage=True,
            allows_profile_update=False,
            allows_usage_activation=False,
        ),
    )
    MERGED_OUT = (
        "merged_out",
        CorporationStatusRule(
            is_terminal=True,
            suspends_usage=True,
            allows_profile_update=False,
            allows_usage_activation=False,
        ),
    )

    @property
    def is_terminal(self) -> bool:
        """存続状態が終端状態かどうかを返す。"""
        return self._rule.is_terminal

    @property
    def suspends_usage(self) -> bool:
        """この存続状態への遷移時にシステム利用を停止するかどうかを返す。"""
        return self._rule.suspends_usage

    @property
    def allows_profile_update(self) -> bool:
        """通常の基本情報更新を許可するかどうかを返す。"""
        return self._rule.allows_profile_update

    @property
    def allows_usage_activation(self) -> bool:
        """システム利用の開始・再開を許可するかどうかを返す。"""
        return self._rule.allows_usage_activation


class CorporationUsageStatus(StrEnum):
    """法人のシステム利用状態。関係図上の参照専用（未利用）とシステム利用中を区別する。"""

    NOT_STARTED = "not_started"
    ACTIVE = "active"
    SUSPENDED = "suspended"


class CorporateRelationType(StrEnum):
    """法人間関係の種別。親子関係の方向は親から子。"""

    PARENT_CHILD = "parent_child"
    AFFILIATE = "affiliate"
    FC_VC = "fc_vc"


@dataclass(frozen=True, slots=True)
class CorporateRelationRevision:
    """関係の適用期間・根拠を、システム記録日時ごとに保持する。"""

    period: EffectiveDateRange
    evidence: CorporationEvidence
    recorded_at: AwareDatetime
    recorded_by: str | None = None
