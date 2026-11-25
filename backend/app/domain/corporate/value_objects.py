"""法人コンテキストの Value Object。"""

from enum import StrEnum


class CorporationCategory(StrEnum):
    """法人の区分。個人開設者も同一モデルで管理する。"""

    CORPORATION = "corporation"
    INDIVIDUAL = "individual"


class CorporationStatus(StrEnum):
    """法人の存続状態。合併消滅や解散でもレコードは削除せず保持する。"""

    ACTIVE = "active"
    DISSOLVED = "dissolved"
    MERGED_OUT = "merged_out"
