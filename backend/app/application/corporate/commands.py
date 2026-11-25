"""法人更新系（Command）のユースケース実装。"""

from datetime import datetime

from app.application.corporate.contracts import (
    ChangeCorporationStatusInput,
    CorporationItem,
    RegisterCorporationInput,
    UpdateCorporationInput,
)
from app.application.corporate.mappers import (
    parse_category,
    parse_status,
    to_application_error,
    to_corporation_item,
)
from app.application.corporate.ports import CorporationUnitOfWorkFactory
from app.application.foundation.errors import ApplicationBadRequestError
from app.application.foundation.ports import Clock, IdGenerator
from app.domain.corporate.entities import Corporation
from app.domain.corporate.exceptions import (
    CorporationNotFoundError,
    DuplicateCorporateNumberError,
)
from app.domain.corporate.identifiers import CorporationId
from app.domain.corporate.primitives import (
    CorporateAddress,
    CorporateNumber,
    CorporationName,
)
from app.domain.corporate.value_objects import CorporationStatus
from app.domain.foundation.exceptions import DomainError
from app.domain.foundation.primitives import AwareDatetime


class CorporationCommandService:
    """法人登録・基本情報更新・存続状態変更を担う Command サービス。"""

    def __init__(
        self,
        *,
        uow_factory: CorporationUnitOfWorkFactory,
        clock: Clock,
        id_generator: IdGenerator,
    ) -> None:
        self._uow_factory = uow_factory
        self._clock = clock
        self._id_generator = id_generator

    def register_corporation(
        self,
        data: RegisterCorporationInput,
        *,
        corporation_id: str | None = None,
        now: datetime | None = None,
    ) -> CorporationItem:
        """新しい法人（または個人開設者）を登録する。"""
        resolved_now = now or self._clock.now()
        resolved_id = corporation_id if corporation_id is not None else self._id_generator.new_id()
        category = parse_category(data.category)

        try:
            corporate_number = (
                CorporateNumber.parse(data.corporate_number)
                if data.corporate_number is not None
                else None
            )
            resolved_timestamp = AwareDatetime(resolved_now)
            corporation = Corporation(
                id=CorporationId.parse(resolved_id),
                category=category,
                name=CorporationName.parse(data.name),
                corporate_number=corporate_number,
                address=CorporateAddress.parse(data.address),
                status=CorporationStatus.ACTIVE,
                created_at=resolved_timestamp,
                updated_at=resolved_timestamp,
            )
            with self._uow_factory() as uow:
                if corporate_number is not None and uow.corporations.exists_by_corporate_number(
                    corporate_number
                ):
                    raise DuplicateCorporateNumberError()
                uow.corporations.add(corporation)
                uow.commit()
        except DomainError as exc:
            raise to_application_error(exc) from exc

        return to_corporation_item(corporation)

    def update_corporation(
        self,
        corporation_id: str,
        data: UpdateCorporationInput,
        *,
        now: datetime | None = None,
    ) -> CorporationItem:
        """既存法人の名称・所在地・法人番号を更新する。"""
        provided = data.provided_fields
        clear_corporate_number = False
        if provided is not None:
            if not provided:
                raise ApplicationBadRequestError(
                    "更新する項目を 1 つ以上指定してください", code="EMPTY_UPDATE"
                )
            for field_name in provided:
                if getattr(data, field_name) is None:
                    if field_name == "corporate_number":
                        clear_corporate_number = True
                    else:
                        raise ApplicationBadRequestError(
                            f"更新項目 {field_name} に null は指定できません",
                            code="INVALID_UPDATE",
                        )

        try:
            parsed_id = CorporationId.parse(corporation_id)
            next_name = CorporationName.parse(data.name) if data.name is not None else None
            next_address = (
                CorporateAddress.parse(data.address) if data.address is not None else None
            )
            next_corporate_number = (
                CorporateNumber.parse(data.corporate_number)
                if data.corporate_number is not None
                else None
            )

            with self._uow_factory() as uow:
                current = uow.corporations.get(parsed_id)
                if current is None:
                    raise CorporationNotFoundError()

                updated = current.update_profile(
                    name=next_name,
                    address=next_address,
                    corporate_number=next_corporate_number,
                    clear_corporate_number=clear_corporate_number,
                    updated_at=AwareDatetime(now or self._clock.now()),
                )
                if (
                    next_corporate_number is not None
                    and uow.corporations.exists_by_corporate_number(
                        next_corporate_number,
                        exclude_id=parsed_id,
                    )
                ):
                    raise DuplicateCorporateNumberError()
                uow.corporations.save(updated)
                uow.commit()
        except DomainError as exc:
            raise to_application_error(exc) from exc

        return to_corporation_item(updated)

    def change_status(
        self,
        corporation_id: str,
        data: ChangeCorporationStatusInput,
        *,
        now: datetime | None = None,
    ) -> CorporationItem:
        """法人の存続状態を変更する。"""
        next_status = parse_status(data.status)

        try:
            parsed_id = CorporationId.parse(corporation_id)
            with self._uow_factory() as uow:
                current = uow.corporations.get(parsed_id)
                if current is None:
                    raise CorporationNotFoundError()
                updated = current.change_status(
                    next_status,
                    updated_at=AwareDatetime(now or self._clock.now()),
                )
                uow.corporations.save(updated)
                uow.commit()
        except DomainError as exc:
            raise to_application_error(exc) from exc

        return to_corporation_item(updated)
