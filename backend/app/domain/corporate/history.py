"""法人の有効期間と記録時点に基づく変更・訂正履歴。"""

from dataclasses import dataclass, replace
from datetime import UTC, date
from enum import StrEnum

from app.domain.corporate.entities import Corporation
from app.domain.corporate.identifiers import CorporationId
from app.domain.corporate.value_objects import CorporationStatus
from app.domain.foundation import (
    AwareDatetime,
    DomainValidationError,
    EffectiveDateRange,
    NonEmptyString,
)


class CorporationChangeKind(StrEnum):
    """法人履歴に残す業務操作。"""

    LEGACY = "legacy"
    REGISTRATION = "registration"
    PROFILE = "profile"
    CORRECTION = "correction"
    DISSOLUTION = "dissolution"
    MERGER = "merger"


@dataclass(frozen=True, slots=True)
class CorporationEvidence(NonEmptyString):
    """法人の確認や変更を支える資料・理由のメモ。"""

    def validate(self) -> None:
        super().validate()
        if len(self.value) > 1000:
            raise DomainValidationError("変更根拠は 1000 文字以内で指定してください。")


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
            (
                r
                for r in reversed(recorded)
                if r.kind in (CorporationChangeKind.DISSOLUTION, CorporationChangeKind.MERGER)
            ),
            None,
        )
        profiles = tuple(
            r
            for r in recorded
            if r.kind not in (CorporationChangeKind.DISSOLUTION, CorporationChangeKind.MERGER)
        )
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
    ) -> CorporationHistoryRecord:
        """存続状態が指定日から変わる事実を追記するための記録を作る。"""
        updated = current.change_status(status, updated_at=recorded_at)
        baseline = self.at(effective_date)
        if baseline is None:
            raise DomainValidationError("効力日が確認済みの法人情報より前です。")
        kind = (
            CorporationChangeKind.MERGER
            if status == CorporationStatus.MERGED_OUT
            else CorporationChangeKind.DISSOLUTION
        )
        return CorporationHistoryRecord(
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
