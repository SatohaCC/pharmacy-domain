"""法人の有効期間と記録時点に基づく変更・訂正履歴。"""

from collections.abc import Mapping
from dataclasses import dataclass, replace
from datetime import UTC, date
from enum import StrEnum
from typing import Self

from app.domain.corporate.entities import Corporation
from app.domain.corporate.exceptions import InvalidCorporationTransitionError
from app.domain.corporate.identifiers import CorporationId
from app.domain.corporate.primitives import CorporationEvidence
from app.domain.corporate.value_objects import CorporationStatus
from app.domain.foundation import (
    AwareDatetime,
    DomainValidationError,
    EffectiveDateRange,
)


class CorporationChangeKind(StrEnum):
    """法人履歴に残す業務操作。"""

    _is_status_change: bool

    def __new__(cls, value: str, is_status_change: bool | None = None) -> Self:
        if not isinstance(is_status_change, bool):
            raise TypeError("CorporationChangeKind の定義には is_status_change の指定が必須です。")
        obj = str.__new__(cls, value)
        obj._value_ = value
        obj._is_status_change = is_status_change
        return obj

    LEGACY = ("legacy", False)
    REGISTRATION = ("registration", False)
    PROFILE = ("profile", False)
    CORRECTION = ("correction", False)
    DISSOLUTION = ("dissolution", True)
    MERGER = ("merger", True)

    @property
    def is_status_change(self) -> bool:
        """存続状態の変更を表す操作種別かどうかを返す。"""
        return self._is_status_change


_STATUS_CHANGE_KINDS: dict[CorporationStatus, CorporationChangeKind | None] = {
    CorporationStatus.ACTIVE: None,
    CorporationStatus.DISSOLVED: CorporationChangeKind.DISSOLUTION,
    CorporationStatus.MERGED_OUT: CorporationChangeKind.MERGER,
}


def _validate_status_change_kinds(
    mapping: Mapping[CorporationStatus, CorporationChangeKind | None],
) -> None:
    missing = set(CorporationStatus) - set(mapping)
    if missing:
        names = ", ".join(sorted(status.value for status in missing))
        raise ValueError(f"CorporationStatus に対応する履歴種別が未定義です: {names}")
    for status, kind in mapping.items():
        if kind is not None and not kind.is_status_change:
            raise ValueError(
                f"状態遷移先 {status.value} に状態変更ではない履歴種別 "
                f"{kind.value} は指定できません。"
            )


_validate_status_change_kinds(_STATUS_CHANGE_KINDS)


def status_change_kind_for(status: CorporationStatus) -> CorporationChangeKind | None:
    """存続状態に対応する履歴操作種別を返す。未定義状態は ValueError。"""
    if status not in _STATUS_CHANGE_KINDS:
        raise ValueError(f"未定義の存続状態です: {status}")
    return _STATUS_CHANGE_KINDS[status]


@dataclass(frozen=True, slots=True)
class CorporationStatusTransition:
    """存続状態遷移の結果として確定した現在法人と追記用履歴記録。"""

    corporation: Corporation
    record: CorporationHistoryRecord


@dataclass(frozen=True, slots=True)
class CorporationHistoryRecord:
    """一度の操作で確認された法人情報と、その適用範囲を保持する。"""

    corporation: Corporation
    period: EffectiveDateRange
    kind: CorporationChangeKind
    evidence: CorporationEvidence | None = None
    surviving_corporation_id: CorporationId | None = None
    recorded_by: str | None = None

    def __post_init__(self) -> None:
        if self.surviving_corporation_id == self.corporation.id:
            raise DomainValidationError(
                "同じ法人を合併先には指定できません。", code="SELF_CORPORATION_MERGER"
            )
        if self.surviving_corporation_id is not None and (
            self.kind != CorporationChangeKind.MERGER or self.evidence is None
        ):
            raise DomainValidationError("存続法人を指定する合併には根拠が必要です。")

    @property
    def recorded_at(self) -> AwareDatetime:
        """この変更または訂正が登録された日時を返す。"""
        return self.corporation.updated_at


@dataclass(frozen=True, slots=True)
class CorporationHistory:
    """追記順の記録から、指定日に把握していた法人情報を復元する。"""

    records: tuple[CorporationHistoryRecord, ...]

    def append(self, record: CorporationHistoryRecord) -> CorporationHistory:
        """既存の記録を保持し、新しい記録を追加した履歴を返す。"""
        return CorporationHistory((*self.records, record))

    def at(
        self, day: date, recorded_as_of: AwareDatetime | None = None
    ) -> CorporationHistoryRecord | None:
        """業務上の指定日と記録の締切日時で状態を復元する。"""
        cutoff = recorded_as_of.value.astimezone(UTC) if recorded_as_of is not None else None
        recorded = (
            tuple(r for r in self.records if r.recorded_at.value.astimezone(UTC) <= cutoff)
            if cutoff is not None
            else self.records
        )
        status_change = next(
            (r for r in reversed(recorded) if r.kind.is_status_change),
            None,
        )
        profiles = tuple(r for r in recorded if not r.kind.is_status_change)
        for index in range(len(profiles) - 1, -1, -1):
            selected = profiles[index]
            if selected.period.contains(day):
                return self._project(selected, profiles[index + 1 :], status_change, day)
        return None

    @staticmethod
    def _project(
        selected: CorporationHistoryRecord,
        later_profiles: tuple[CorporationHistoryRecord, ...],
        status_change: CorporationHistoryRecord | None,
        day: date,
    ) -> CorporationHistoryRecord:
        start = selected.period.valid_from
        end = selected.period.valid_to
        for record in later_profiles:
            other = record.period
            if other.valid_from > day:
                end = other.valid_from if end is None else min(end, other.valid_from)
            elif other.valid_to is not None and other.valid_to <= day:
                start = max(start, other.valid_to)

        if status_change is not None:
            transition = status_change.period.valid_from
            if transition <= day:
                return replace(
                    status_change,
                    corporation=replace(
                        selected.corporation,
                        status=status_change.corporation.status,
                        usage_status=status_change.corporation.usage_status,
                        updated_at=max(selected.recorded_at, status_change.recorded_at),
                    ),
                    period=EffectiveDateRange(max(start, transition), end),
                )
            end = transition if end is None else min(end, transition)

        return replace(selected, period=EffectiveDateRange(start, end))

    def record_status(
        self,
        current: Corporation,
        status: CorporationStatus,
        *,
        effective_date: date,
        recorded_at: AwareDatetime,
        evidence: CorporationEvidence | None,
        surviving_corporation_id: CorporationId | None,
        recorded_by: str | None = None,
    ) -> CorporationStatusTransition:
        """存続状態が指定日から変わる事実を追記するための遷移結果と履歴記録を作る。"""
        updated = current.change_status(status, updated_at=recorded_at)
        baseline = self.at(effective_date)
        if baseline is None:
            raise DomainValidationError("効力日が確認済みの法人情報より前です。")
        kind = status_change_kind_for(updated.status)
        if kind is None:
            raise InvalidCorporationTransitionError(
                "指定された存続状態への遷移は履歴に記録できません。",
                details={"target_status": updated.status.value},
            )
        record = CorporationHistoryRecord(
            replace(
                baseline.corporation,
                status=updated.status,
                usage_status=updated.usage_status,
                updated_at=recorded_at,
            ),
            EffectiveDateRange(effective_date),
            kind,
            evidence,
            surviving_corporation_id,
            recorded_by,
        )
        return CorporationStatusTransition(corporation=updated, record=record)
