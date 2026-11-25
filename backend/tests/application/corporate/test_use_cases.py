from datetime import UTC, datetime
from types import TracebackType

import pytest

from app.application.corporate.commands import CorporationCommandService
from app.application.corporate.contracts import (
    ChangeCorporationStatusInput,
    CorporationItem,
    CorporationListResult,
    ListCorporationsQuery,
    RegisterCorporationInput,
    UpdateCorporationInput,
)
from app.application.corporate.queries import CorporationQueryService
from app.application.foundation.errors import (
    ApplicationBadRequestError,
    ApplicationConflictError,
    ApplicationNotFoundError,
    ApplicationValidationError,
)
from app.domain.corporate.entities import Corporation
from app.domain.corporate.history import CorporationHistoryRecord
from app.domain.corporate.identifiers import CorporationId
from app.domain.corporate.primitives import CorporateNumber


class _FixedClock:
    def __init__(self, fixed_now: datetime) -> None:
        self._now = fixed_now

    def now(self) -> datetime:
        return self._now


class _SequentialIdGenerator:
    def __init__(self, prefix: str = "corp") -> None:
        self._prefix = prefix
        self._count = 0

    def new_id(self) -> str:
        self._count += 1
        return f"{self._prefix}-{self._count}"


class _FakeCorporationRepository:
    def __init__(
        self,
        committed: dict[str, Corporation],
        history: dict[str, tuple[CorporationHistoryRecord, ...]],
    ) -> None:
        self._committed = committed
        self._working: dict[str, Corporation] = dict(committed)
        self._committed_history = history
        self._working_history = dict(history)

    def add(self, corporation: Corporation) -> None:
        self._working[corporation.id.value] = corporation

    def get(self, corporation_id: CorporationId) -> Corporation | None:
        return self._working.get(corporation_id.value)

    def exists_by_corporate_number(
        self,
        corporate_number: CorporateNumber,
        *,
        exclude_id: CorporationId | None = None,
    ) -> bool:
        for corp in self._working.values():
            if exclude_id is not None and corp.id == exclude_id:
                continue
            if corp.corporate_number == corporate_number:
                return True
        return False

    def save(self, corporation: Corporation) -> None:
        self._working[corporation.id.value] = corporation

    def history(self, corporation_id: CorporationId) -> tuple[CorporationHistoryRecord, ...]:
        return self._working_history.get(corporation_id.value, ())

    def append_history(self, record: CorporationHistoryRecord) -> None:
        identifier = record.corporation.id
        self._working_history[identifier.value] = (*self.history(identifier), record)

    def flush_to_committed(self) -> None:
        self._committed.clear()
        self._committed.update(self._working)
        self._committed_history.update(self._working_history)


class _FakeCorporationUnitOfWork:
    def __init__(
        self,
        committed: dict[str, Corporation],
        events: list[str],
        history: dict[str, tuple[CorporationHistoryRecord, ...]],
    ) -> None:
        self._events = events
        self._is_committed = False
        self._corporations = _FakeCorporationRepository(committed, history)

    @property
    def corporations(self) -> _FakeCorporationRepository:
        return self._corporations

    def __enter__(self) -> _FakeCorporationUnitOfWork:
        self._events.append("enter")
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: TracebackType | None,
    ) -> None:
        if not self._is_committed:
            self._events.append("rollback")
        self._events.append("exit")

    def commit(self) -> None:
        self._corporations.flush_to_committed()
        self._is_committed = True
        self._events.append("commit")

    def rollback(self) -> None:
        self._events.append("rollback")


class _FakeCorporationQueryPort:
    def __init__(
        self,
        committed: dict[str, Corporation],
        history: dict[str, tuple[CorporationHistoryRecord, ...]],
    ) -> None:
        self._committed = committed
        self._history = history

    def get_history(
        self, corporation_id: CorporationId
    ) -> tuple[CorporationHistoryRecord, ...] | None:
        return self._history.get(corporation_id.value)

    def get_corporation(self, corporation_id: str) -> CorporationItem | None:
        corp = self._committed.get(corporation_id)
        if corp is None:
            return None
        return CorporationItem(
            id=corp.id.value,
            category=corp.category.value,
            name=corp.name.value,
            corporate_number=(
                corp.corporate_number.value if corp.corporate_number is not None else None
            ),
            address=corp.address.value,
            status=corp.status.value,
            created_at=corp.created_at.value,
            updated_at=corp.updated_at.value,
        )

    def list_corporations(self, query: ListCorporationsQuery) -> CorporationListResult:
        items = [
            CorporationItem(
                id=corp.id.value,
                category=corp.category.value,
                name=corp.name.value,
                corporate_number=(
                    corp.corporate_number.value if corp.corporate_number is not None else None
                ),
                address=corp.address.value,
                status=corp.status.value,
                created_at=corp.created_at.value,
                updated_at=corp.updated_at.value,
            )
            for corp in self._committed.values()
        ]
        return CorporationListResult(items=tuple(items), total=len(items))


def test_corporation_use_cases_register_duplicate_check_and_status_transition() -> None:
    store: dict[str, Corporation] = {}
    history: dict[str, tuple[CorporationHistoryRecord, ...]] = {}
    events: list[str] = []
    fixed_now = datetime(2026, 11, 21, 10, 0, tzinfo=UTC)

    commands = CorporationCommandService(
        uow_factory=lambda: _FakeCorporationUnitOfWork(store, events, history),
        clock=_FixedClock(fixed_now),
        id_generator=_SequentialIdGenerator(),
    )
    queries = CorporationQueryService(query_gateway=_FakeCorporationQueryPort(store, history))

    created = commands.register_corporation(
        RegisterCorporationInput(
            category="corporation",
            name="  株式会社テスト薬局  ",
            corporate_number="1234567890123",
            address="  東京都千代田区1-1  ",
        )
    )
    assert created.id == "corp-1"
    assert created.name == "株式会社テスト薬局"
    assert created.corporate_number == "1234567890123"
    assert created.status == "active"
    assert events == ["enter", "commit", "exit"]

    # 同じ 13 桁法人番号の重複登録は Conflict となりロールバックされる。
    events.clear()
    with pytest.raises(ApplicationConflictError) as dup_exc:
        commands.register_corporation(
            RegisterCorporationInput(
                category="corporation",
                name="別法人",
                corporate_number="1234567890123",
            )
        )
    assert dup_exc.value.code == "DUPLICATE_CORPORATE_NUMBER"
    assert events == ["enter", "rollback", "exit"]

    # 個人区分は法人番号を持たず複数登録できる。
    events.clear()
    ind = commands.register_corporation(
        RegisterCorporationInput(category="individual", name="山田薬局")
    )
    assert ind.category == "individual"
    assert ind.corporate_number is None

    # 個人区分への法人番号付与は失敗する。
    with pytest.raises(ApplicationValidationError):
        commands.update_corporation(
            ind.id,
            UpdateCorporationInput(
                corporate_number="9999999999999",
                provided_fields=frozenset({"corporate_number"}),
            ),
        )

    # 法人区分で自法人の同じ法人番号を維持した更新は成功する。
    same_number = commands.update_corporation(
        created.id,
        UpdateCorporationInput(
            corporate_number="1234567890123",
            address="",
            provided_fields=frozenset({"corporate_number", "address"}),
        ),
    )
    assert same_number.corporate_number == "1234567890123"
    assert same_number.address == ""

    # address=null は INVALID_UPDATE となる。
    with pytest.raises(ApplicationBadRequestError) as null_addr_exc:
        commands.update_corporation(
            created.id,
            UpdateCorporationInput(address=None, provided_fields=frozenset({"address"})),
        )
    assert null_addr_exc.value.code == "INVALID_UPDATE"

    # 法人番号の null 指定により番号未設定へクリアできる。
    cleared = commands.update_corporation(
        created.id,
        UpdateCorporationInput(
            corporate_number=None,
            provided_fields=frozenset({"corporate_number"}),
        ),
    )
    assert cleared.corporate_number is None

    # 別法人が使用中の法人番号への更新は Conflict となる。
    other = commands.register_corporation(
        RegisterCorporationInput(
            category="corporation",
            name="別法人テスト",
            corporate_number="9876543210987",
        )
    )
    with pytest.raises(ApplicationConflictError) as dup_update_exc:
        commands.update_corporation(
            created.id,
            UpdateCorporationInput(
                corporate_number=other.corporate_number,
                provided_fields=frozenset({"corporate_number"}),
            ),
        )
    assert dup_update_exc.value.code == "DUPLICATE_CORPORATE_NUMBER"

    # Query サービスで取得・一覧参照できる。
    fetched = queries.get_corporation(created.id)
    assert fetched.id == created.id
    assert queries.list_corporations(ListCorporationsQuery()).total == 3

    # 存在しない法人の取得は NotFound。
    with pytest.raises(ApplicationNotFoundError):
        queries.get_corporation("missing")

    # 存続状態変更と、消滅後のプロファイル変更・再遷移拒否。
    dissolved = commands.change_status(created.id, ChangeCorporationStatusInput(status="dissolved"))
    assert dissolved.status == "dissolved"
    with pytest.raises(ApplicationBadRequestError) as dissolved_update_exc:
        commands.update_corporation(
            created.id,
            UpdateCorporationInput(name="解散後変更", provided_fields=frozenset({"name"})),
        )
    assert dissolved_update_exc.value.code == "INVALID_UPDATE"
    with pytest.raises(ApplicationBadRequestError):
        commands.change_status(created.id, ChangeCorporationStatusInput(status="active"))
