"""法人更新系（Command）のユースケース実装。"""

from dataclasses import replace
from datetime import UTC, date, datetime, timedelta, timezone

from app.application.corporate.contracts import (
    ChangeCorporationStatusInput,
    CorporationHistoryItem,
    CorporationItem,
    RegisterCorporationInput,
    UpdateCorporationInput,
)
from app.application.corporate.mappers import (
    parse_category,
    parse_status,
    to_application_error,
    to_corporation_history_item,
    to_corporation_item,
)
from app.application.corporate.ports import CorporationUnitOfWorkFactory
from app.application.foundation.errors import ApplicationBadRequestError
from app.application.foundation.ports import Clock, IdGenerator
from app.domain.corporate.entities import Corporation
from app.domain.corporate.exceptions import (
    CorporationNotFoundError,
    DuplicateCorporateNumberError,
    InvalidCorporationUpdateError,
)
from app.domain.corporate.history import (
    CorporationChangeKind,
    CorporationEvidence,
    CorporationHistory,
    CorporationHistoryRecord,
)
from app.domain.corporate.identifiers import CorporationId
from app.domain.corporate.primitives import (
    CorporateAddress,
    CorporateNumber,
    CorporationName,
)
from app.domain.corporate.value_objects import CorporationStatus
from app.domain.foundation.exceptions import DomainError, DomainValidationError
from app.domain.foundation.primitives import AwareDatetime
from app.domain.foundation.value_objects import EffectiveDateRange

_JAPAN_TIME = timezone(timedelta(hours=9))
_PROFILE_FIELDS = frozenset({"name", "address", "corporate_number"})
_UPDATE_FIELDS = frozenset({"name", "address", "corporate_number", "valid_to"})


def _effective_date(requested: date | None, today: date) -> date:
    if requested is None:
        return today
    if requested > today:
        raise DomainValidationError(
            "将来の効力日は指定できません。", details={"field": "effective_date"}
        )
    return requested


def _evidence(value: str | None) -> CorporationEvidence | None:
    return CorporationEvidence.parse(value) if value is not None else None


def _next_recorded_time(clock_time: AwareDatetime, current: Corporation) -> AwareDatetime:
    previous = current.updated_at.value.astimezone(UTC)
    actual = clock_time.value.astimezone(UTC)
    return AwareDatetime(actual if actual > previous else previous + timedelta(microseconds=1))


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
            effective_date = _effective_date(
                data.valid_from, resolved_now.astimezone(_JAPAN_TIME).date()
            )
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
                period = EffectiveDateRange(effective_date, data.valid_to)
                uow.corporations.add(corporation)
                uow.corporations.append_history(
                    CorporationHistoryRecord(
                        corporation,
                        period,
                        CorporationChangeKind.REGISTRATION,
                        _evidence(data.evidence),
                    )
                )
                uow.commit()
        except DomainError as exc:
            raise to_application_error(exc) from exc

        return to_corporation_item(corporation, period=period)

    def update_corporation(
        self,
        corporation_id: str,
        data: UpdateCorporationInput,
        *,
        now: datetime | None = None,
    ) -> CorporationItem:
        """既存法人の名称・所在地・法人番号・有効終了日を更新する。"""
        updated, _record, latest = self._record_profile_change(
            corporation_id, data.valid_from, data, correction=False, now=now
        )
        return to_corporation_item(updated, period=latest.period)

    def correct_history(
        self, corporation_id: str, as_of: date, data: UpdateCorporationInput
    ) -> CorporationHistoryItem:
        """対象期間の基本情報を訂正し、それ以前の記録を保持する。"""
        _current, record, _latest = self._record_profile_change(
            corporation_id, as_of, data, correction=True, now=None
        )
        return to_corporation_history_item(record)

    def _record_profile_change(
        self,
        corporation_id: str,
        effective_date: date | None,
        data: UpdateCorporationInput,
        *,
        correction: bool,
        now: datetime | None,
    ) -> tuple[Corporation, CorporationHistoryRecord, CorporationHistoryRecord]:
        allowed_fields = _UPDATE_FIELDS | {"valid_from"} if correction else _UPDATE_FIELDS
        provided = (
            data.provided_fields & allowed_fields if data.provided_fields is not None else None
        )
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
                    elif field_name == "valid_to":
                        continue
                    else:
                        raise ApplicationBadRequestError(
                            f"更新項目 {field_name} に null は指定できません",
                            code="INVALID_UPDATE",
                        )

        try:
            parsed_id = CorporationId.parse(corporation_id)
            evidence = _evidence(data.evidence)
            if correction and evidence is None:
                raise DomainValidationError("履歴の訂正には根拠を指定してください。")
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
                clock_time = AwareDatetime(now or self._clock.now())
                today = clock_time.value.astimezone(_JAPAN_TIME).date()
                resolved_now = _next_recorded_time(clock_time, current)
                effective = _effective_date(effective_date, today)
                if not correction and current.status != CorporationStatus.ACTIVE:
                    raise InvalidCorporationUpdateError(
                        "解散または合併消滅した法人の基本情報は変更できません。",
                        details={"current_status": current.status.value},
                    )
                history = CorporationHistory(uow.corporations.history(parsed_id))
                old = history.at(effective)
                if old is None:
                    raise DomainValidationError("効力日が確認済みの法人情報より前です。")
                # 当日の通常更新は、トランザクション内で確定済みの現在行を基にする。
                baseline = current if effective == today and not correction else old.corporation
                has_profile_change = (
                    next_name is not None
                    or next_address is not None
                    or next_corporate_number is not None
                    or clear_corporate_number
                )
                if has_profile_change:
                    change_profile = (
                        baseline.correct_profile if correction else baseline.update_profile
                    )
                    revised = change_profile(
                        name=next_name,
                        address=next_address,
                        corporate_number=next_corporate_number,
                        clear_corporate_number=clear_corporate_number,
                        updated_at=resolved_now,
                    )
                else:
                    revised = replace(baseline, updated_at=resolved_now)
                valid_to_provided = (
                    "valid_to" in provided if provided is not None else data.valid_to is not None
                )
                next_valid_to = data.valid_to if valid_to_provided else old.period.valid_to
                next_period = (
                    EffectiveDateRange(
                        data.valid_from
                        if correction and data.valid_from is not None
                        else old.period.valid_from,
                        next_valid_to,
                    )
                    if correction
                    else EffectiveDateRange(effective, next_valid_to)
                )
                record = CorporationHistoryRecord(
                    revised,
                    next_period,
                    CorporationChangeKind.CORRECTION
                    if correction
                    else CorporationChangeKind.PROFILE,
                    evidence,
                )
                appended = history.append(record)
                latest = appended.at(today) or appended.records[-1]
                updated = replace(latest.corporation, updated_at=resolved_now)
                if (
                    updated.corporate_number is not None
                    and uow.corporations.exists_by_corporate_number(
                        updated.corporate_number,
                        exclude_id=parsed_id,
                    )
                ):
                    raise DuplicateCorporateNumberError()
                uow.corporations.save(updated)
                uow.corporations.append_history(record)
                uow.commit()
        except DomainError as exc:
            raise to_application_error(exc) from exc

        return updated, record, latest

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
            surviving_id = (
                CorporationId.parse(data.surviving_corporation_id)
                if data.surviving_corporation_id is not None
                else None
            )
            with self._uow_factory() as uow:
                current = uow.corporations.get(parsed_id)
                if current is None:
                    raise CorporationNotFoundError()
                clock_time = AwareDatetime(now or self._clock.now())
                today = clock_time.value.astimezone(_JAPAN_TIME).date()
                resolved_now = _next_recorded_time(clock_time, current)
                effective_date = _effective_date(data.effective_date, today)
                history = CorporationHistory(uow.corporations.history(parsed_id))
                record = history.record_status(
                    current,
                    next_status,
                    effective_date=effective_date,
                    recorded_at=resolved_now,
                    evidence=_evidence(data.evidence),
                    surviving_corporation_id=surviving_id,
                )
                if surviving_id is not None and uow.corporations.get(surviving_id) is None:
                    raise CorporationNotFoundError()
                updated = replace(current, status=next_status, updated_at=resolved_now)
                uow.corporations.save(updated)
                uow.corporations.append_history(record)
                uow.commit()
        except DomainError as exc:
            raise to_application_error(exc) from exc

        return to_corporation_item(updated)
