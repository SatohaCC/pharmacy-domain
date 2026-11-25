"""業務非依存のドメイン共通 Value Object。"""

import re
from dataclasses import dataclass
from datetime import date, datetime
from typing import Self

from app.domain.foundation.exceptions import DomainValidationError

_ISO_DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")

_DATE_FIELD_MESSAGES: dict[str, str] = {
    "valid_from": "有効開始日は日付で指定してください。",
    "valid_to": "有効終了日は日付で指定してください。",
}


def _validate_date(value: date, *, field: str) -> date:
    """datetime（date のサブクラス）を除外し、純粋な date 型であることを検証する。"""
    if not isinstance(value, date) or isinstance(value, datetime):
        message = _DATE_FIELD_MESSAGES.get(field, "日付を指定してください。")
        raise DomainValidationError(message, details={"field": field})
    return value


def _parse_date(raw: date | str, *, field: str) -> date:
    """日付または ISO 8601 日付文字列（YYYY-MM-DD）を検証して date へ変換する。"""
    if isinstance(raw, str):
        if not _ISO_DATE_PATTERN.fullmatch(raw):
            raise DomainValidationError(
                "日付は YYYY-MM-DD 形式で指定してください。",
                details={"field": field},
            )
        try:
            return date.fromisoformat(raw)
        except ValueError as exc:
            raise DomainValidationError(
                "日付は YYYY-MM-DD 形式で指定してください。",
                details={"field": field},
            ) from exc
    return _validate_date(raw, field=field)


@dataclass(frozen=True, slots=True)
class EffectiveDateRange:
    """日単位の半開区間 [valid_from, valid_to) を表す不変 Value Object。"""

    valid_from: date
    valid_to: date | None = None

    def __post_init__(self) -> None:
        _validate_date(self.valid_from, field="valid_from")
        if self.valid_to is not None:
            _validate_date(self.valid_to, field="valid_to")
            if self.valid_from >= self.valid_to:
                raise DomainValidationError(
                    "有効終了日は有効開始日より後の日付である必要があります。",
                    details={"field": "valid_to"},
                )

    @property
    def is_open_ended(self) -> bool:
        """終了日未定（無期限）であるかを返す。"""
        return self.valid_to is None

    @classmethod
    def parse(cls, valid_from: date | str, valid_to: date | str | None = None) -> Self:
        """日付または YYYY-MM-DD 文字列から半開区間有効期間を生成する。"""
        parsed_from = _parse_date(valid_from, field="valid_from")
        parsed_to = _parse_date(valid_to, field="valid_to") if valid_to is not None else None
        return cls(valid_from=parsed_from, valid_to=parsed_to)

    def contains(self, as_of: date) -> bool:
        """指定日 as_of が有効期間 [valid_from, valid_to) に含まれるかを判定する。"""
        _validate_date(as_of, field="as_of")
        return self.valid_from <= as_of and (self.valid_to is None or as_of < self.valid_to)

    def overlaps(self, other: EffectiveDateRange) -> bool:
        """他の有効期間と重複する日があるかを判定する（境界隣接は重複しない）。"""
        starts_before_other_ends = other.valid_to is None or self.valid_from < other.valid_to
        other_starts_before_ends = self.valid_to is None or other.valid_from < self.valid_to
        return starts_before_other_ends and other_starts_before_ends

    def close_at(self, end_date: date) -> EffectiveDateRange:
        """指定した有効終了日で期間を終了（または短縮）した新しい区間を返す。"""
        _validate_date(end_date, field="valid_to")
        if self.valid_to is not None and end_date > self.valid_to:
            raise DomainValidationError(
                "現在の有効終了日より後の日付では終了できません。",
                details={"field": "valid_to"},
            )
        return EffectiveDateRange(valid_from=self.valid_from, valid_to=end_date)
