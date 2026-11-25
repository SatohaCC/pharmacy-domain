"""法人コンテキストの Value Object。"""

from dataclasses import dataclass
from enum import StrEnum

from app.domain.corporate.primitives import RelationEvidence
from app.domain.foundation.primitives import AwareDatetime
from app.domain.foundation.value_objects import EffectiveDateRange


class CorporationCategory(StrEnum):
    """法人の区分。個人開設者も同一モデルで管理する。"""

    CORPORATION = "corporation"
    INDIVIDUAL = "individual"


class CorporationStatus(StrEnum):
    """法人の存続状態。合併消滅や解散でもレコードは削除せず保持する。"""

    ACTIVE = "active"
    DISSOLVED = "dissolved"
    MERGED_OUT = "merged_out"


class CorporateRelationType(StrEnum):
    """法人間関係の種別。親子関係の方向は親から子。"""

    PARENT_CHILD = "parent_child"
    AFFILIATE = "affiliate"
    FC_VC = "fc_vc"


class RelationConfirmationStatus(StrEnum):
    """法人間関係の根拠を確認済みかどうか。"""

    UNVERIFIED = "unverified"
    VERIFIED = "verified"


@dataclass(frozen=True, slots=True)
class CorporateRelationRevision:
    """関係の適用期間・根拠・確認状態を、システム記録日時ごとに保持する。"""

    period: EffectiveDateRange
    evidence: RelationEvidence
    confirmation_status: RelationConfirmationStatus
    recorded_at: AwareDatetime
