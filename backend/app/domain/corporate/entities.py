"""法人コンテキストの集約ルート（Aggregate Root）。"""

from dataclasses import dataclass

from app.domain.corporate.exceptions import (
    EmptyCorporationUpdateError,
    InvalidCorporationTransitionError,
    InvalidCorporationUpdateError,
)
from app.domain.corporate.identifiers import CorporationId
from app.domain.corporate.primitives import (
    CorporateAddress,
    CorporateNumber,
    CorporationName,
)
from app.domain.corporate.value_objects import CorporationCategory, CorporationStatus
from app.domain.foundation.exceptions import DomainValidationError
from app.domain.foundation.primitives import AwareDatetime


@dataclass(frozen=True, slots=True)
class Corporation:
    """法人集約ルート。個人区分は法人番号を持たない不変条件を所有する。"""

    id: CorporationId
    category: CorporationCategory
    name: CorporationName
    corporate_number: CorporateNumber | None
    address: CorporateAddress
    status: CorporationStatus
    created_at: AwareDatetime
    updated_at: AwareDatetime

    def __post_init__(self) -> None:
        if self.category == CorporationCategory.INDIVIDUAL and self.corporate_number is not None:
            raise DomainValidationError(
                "個人区分では法人番号を設定できません。",
                details={"field": "corporate_number"},
            )
        if self.updated_at < self.created_at:
            raise DomainValidationError(
                "更新日時は作成日時以降の日時である必要があります。",
                details={"field": "updated_at"},
            )

    def update_profile(
        self,
        *,
        name: CorporationName | None = None,
        address: CorporateAddress | None = None,
        corporate_number: CorporateNumber | None = None,
        clear_corporate_number: bool = False,
        updated_at: AwareDatetime,
    ) -> Corporation:
        """基本情報（名称・所在地・法人番号）を検証して新しい Corporation を返す。"""
        if self.status != CorporationStatus.ACTIVE:
            raise InvalidCorporationUpdateError(
                "解散または合併消滅した法人の基本情報は変更できません。",
                details={"current_status": self.status.value},
            )
        if (
            name is None
            and address is None
            and corporate_number is None
            and not clear_corporate_number
        ):
            raise EmptyCorporationUpdateError()
        if clear_corporate_number and corporate_number is not None:
            raise InvalidCorporationUpdateError(
                "法人番号の設定と解除を同時に指定できません。",
                details={"field": "corporate_number"},
            )
        if self.category == CorporationCategory.INDIVIDUAL and clear_corporate_number:
            raise InvalidCorporationUpdateError(
                "個人区分では法人番号を解除できません。",
                details={"field": "corporate_number"},
            )
        if updated_at < self.updated_at:
            raise DomainValidationError(
                "更新日時は現在の更新日時以降である必要があります。",
                details={"field": "updated_at"},
            )

        if clear_corporate_number:
            next_corporate_number = None
        elif corporate_number is not None:
            next_corporate_number = corporate_number
        else:
            next_corporate_number = self.corporate_number

        return Corporation(
            id=self.id,
            category=self.category,
            name=name if name is not None else self.name,
            corporate_number=next_corporate_number,
            address=address if address is not None else self.address,
            status=self.status,
            created_at=self.created_at,
            updated_at=updated_at,
        )

    def change_status(
        self,
        next_status: CorporationStatus,
        *,
        updated_at: AwareDatetime,
    ) -> Corporation:
        """存続状態を遷移させた新しい Corporation を返す。"""
        if self.status == next_status:
            raise InvalidCorporationTransitionError(
                "指定された存続状態は現在と同じです。",
                details={
                    "current_status": self.status.value,
                    "target_status": next_status.value,
                },
            )
        if self.status in (CorporationStatus.DISSOLVED, CorporationStatus.MERGED_OUT):
            raise InvalidCorporationTransitionError(
                "解散または合併消滅した法人の存続状態は変更できません。",
                details={
                    "current_status": self.status.value,
                    "target_status": next_status.value,
                },
            )
        if updated_at < self.updated_at:
            raise DomainValidationError(
                "更新日時は現在の更新日時以降である必要があります。",
                details={"field": "updated_at"},
            )

        return Corporation(
            id=self.id,
            category=self.category,
            name=self.name,
            corporate_number=self.corporate_number,
            address=self.address,
            status=next_status,
            created_at=self.created_at,
            updated_at=updated_at,
        )
