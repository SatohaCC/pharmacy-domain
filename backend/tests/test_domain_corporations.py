"""法人コンテキストのドメイン単体テスト。"""

from datetime import UTC, datetime, timedelta

import pytest

from app.domain.corporate import (
    CorporateAddress,
    CorporateNumber,
    Corporation,
    CorporationCategory,
    CorporationId,
    CorporationName,
    CorporationNotFoundError,
    CorporationStatus,
    DuplicateCorporateNumberError,
    EmptyCorporationUpdateError,
    InvalidCorporationTransitionError,
    InvalidCorporationUpdateError,
)
from app.domain.foundation import (
    AwareDatetime,
    DomainConflictError,
    DomainNotFoundError,
    DomainValidationError,
)

_DEFAULT_CORPORATE_NUMBER = CorporateNumber("1234567890123")


def _make_corporation(
    *,
    category: CorporationCategory = CorporationCategory.CORPORATION,
    corporate_number: CorporateNumber | None = _DEFAULT_CORPORATE_NUMBER,
    status: CorporationStatus = CorporationStatus.ACTIVE,
    created_at: datetime | None = None,
    updated_at: datetime | None = None,
) -> Corporation:
    base_dt = created_at or datetime(2026, 11, 21, 9, 0, tzinfo=UTC)
    return Corporation(
        id=CorporationId("corp-1"),
        category=category,
        name=CorporationName("株式会社さくら薬局"),
        corporate_number=corporate_number,
        address=CorporateAddress("東京都新宿区"),
        status=status,
        created_at=AwareDatetime(base_dt),
        updated_at=AwareDatetime(updated_at or base_dt),
    )


def test_corporation_id_validates_pattern_and_length() -> None:
    assert CorporationId.parse("  corp-1_A  ") == CorporationId("corp-1_A")
    assert CorporationId("a" * 128).value == "a" * 128

    with pytest.raises(DomainValidationError, match="空文字"):
        CorporationId("   ")
    with pytest.raises(DomainValidationError, match="使用できない文字"):
        CorporationId("corp/1")
    with pytest.raises(DomainValidationError, match="128 文字以内"):
        CorporationId("a" * 129)


def test_corporation_name_validates_invariants() -> None:
    assert CorporationName.parse("  株式会社テスト薬局  ") == CorporationName("株式会社テスト薬局")
    assert CorporationName("あ" * 200).value == "あ" * 200

    with pytest.raises(DomainValidationError, match="空文字"):
        CorporationName.parse("   ")
    with pytest.raises(DomainValidationError, match="空文字"):
        CorporationName("  株式会社テスト薬局  ")
    with pytest.raises(DomainValidationError, match="制御文字"):
        CorporationName("株式会社\nテスト薬局")
    with pytest.raises(DomainValidationError, match="制御文字"):
        CorporationName("株式会社\x00テスト薬局")
    with pytest.raises(DomainValidationError, match="200 文字以内"):
        CorporationName("あ" * 201)


def test_corporate_number_validates_13_ascii_digits() -> None:
    assert CorporateNumber.parse(" 1234567890123 ") == CorporateNumber("1234567890123")

    for invalid in (
        "",
        "123456789012",
        "12345678901234",
        "123456789012a",
        "１２３４５６７８９０１２３",
    ):
        with pytest.raises(DomainValidationError):
            CorporateNumber.parse(invalid)


def test_corporate_address_validates_invariants() -> None:
    assert CorporateAddress("") == CorporateAddress("")
    assert CorporateAddress.parse("   ") == CorporateAddress("")
    assert CorporateAddress.parse("  東京都渋谷区  ") == CorporateAddress("東京都渋谷区")
    assert CorporateAddress("あ" * 500).value == "あ" * 500

    with pytest.raises(DomainValidationError, match="前後に空白"):
        CorporateAddress("   ")
    with pytest.raises(DomainValidationError, match="前後に空白"):
        CorporateAddress("  東京都渋谷区  ")
    with pytest.raises(DomainValidationError, match="制御文字"):
        CorporateAddress("東京都\r\n渋谷区")
    with pytest.raises(DomainValidationError, match="500 文字以内"):
        CorporateAddress("あ" * 501)


def test_corporation_post_init_enforces_invariants() -> None:
    base_dt = datetime(2026, 11, 21, 9, 0, tzinfo=UTC)

    # 個人区分は法人番号なし、法人区分は番号未確認（None）も許容する。
    individual = _make_corporation(
        category=CorporationCategory.INDIVIDUAL,
        corporate_number=None,
    )
    assert individual.corporate_number is None

    unverified_corp = _make_corporation(
        category=CorporationCategory.CORPORATION,
        corporate_number=None,
    )
    assert unverified_corp.corporate_number is None

    # 個人区分は 13 桁法人番号を持てない。
    with pytest.raises(DomainValidationError, match="個人区分"):
        _make_corporation(
            category=CorporationCategory.INDIVIDUAL,
            corporate_number=CorporateNumber("1234567890123"),
        )

    # 更新日時が作成日時より前の場合はエラー。
    with pytest.raises(DomainValidationError, match="作成日時以降"):
        _make_corporation(
            created_at=base_dt,
            updated_at=base_dt - timedelta(seconds=1),
        )


def test_corporation_update_profile_validates_all_branches() -> None:
    base_dt = datetime(2026, 11, 21, 9, 0, tzinfo=UTC)
    corp = _make_corporation(created_at=base_dt, updated_at=base_dt)

    with pytest.raises(EmptyCorporationUpdateError):
        corp.update_profile(updated_at=AwareDatetime(base_dt + timedelta(minutes=1)))

    # 法人番号の設定と解除の同時指定は禁止する。
    with pytest.raises(InvalidCorporationUpdateError, match="同時に指定できません"):
        corp.update_profile(
            corporate_number=CorporateNumber("9999999999999"),
            clear_corporate_number=True,
            updated_at=AwareDatetime(base_dt + timedelta(minutes=1)),
        )

    # 同一タイムスタンプの更新は許容し、元インスタンスは不変のまま維持する。
    renamed = corp.update_profile(
        name=CorporationName("株式会社さくら薬局ホールディングス"),
        updated_at=AwareDatetime(base_dt),
    )
    assert renamed.name.value == "株式会社さくら薬局ホールディングス"
    assert corp.name.value == "株式会社さくら薬局"

    # 所在地・法人番号の単体更新と法人番号の解除。
    relocated = renamed.update_profile(
        address=CorporateAddress("大阪府大阪市"),
        updated_at=AwareDatetime(base_dt + timedelta(minutes=2)),
    )
    assert relocated.address.value == "大阪府大阪市"

    cleared = relocated.update_profile(
        clear_corporate_number=True,
        updated_at=AwareDatetime(base_dt + timedelta(minutes=3)),
    )
    assert cleared.corporate_number is None

    reassigned = cleared.update_profile(
        corporate_number=CorporateNumber("9876543210123"),
        updated_at=AwareDatetime(base_dt + timedelta(minutes=4)),
    )
    assert reassigned.corporate_number == CorporateNumber("9876543210123")

    # 過去の更新日時への逆行を禁止する。
    with pytest.raises(DomainValidationError, match="現在の更新日時以降"):
        reassigned.update_profile(
            address=CorporateAddress("逆行アドレス"),
            updated_at=AwareDatetime(base_dt + timedelta(minutes=1)),
        )

    # 個人区分は法人番号の設定も解除も不可。
    individual = _make_corporation(
        category=CorporationCategory.INDIVIDUAL,
        corporate_number=None,
        created_at=base_dt,
        updated_at=base_dt,
    )
    with pytest.raises(DomainValidationError, match="個人区分"):
        individual.update_profile(
            corporate_number=CorporateNumber("1234567890123"),
            updated_at=AwareDatetime(base_dt + timedelta(minutes=1)),
        )
    with pytest.raises(InvalidCorporationUpdateError, match="解除できません"):
        individual.update_profile(
            clear_corporate_number=True,
            updated_at=AwareDatetime(base_dt + timedelta(minutes=1)),
        )


def test_corporation_change_status_and_terminal_locks() -> None:
    base_dt = datetime(2026, 11, 21, 9, 0, tzinfo=UTC)
    corp = _make_corporation(created_at=base_dt, updated_at=base_dt)

    # 同一状態への遷移は禁止する。
    with pytest.raises(InvalidCorporationTransitionError, match="現在と同じ") as same_exc:
        corp.change_status(
            CorporationStatus.ACTIVE,
            updated_at=AwareDatetime(base_dt + timedelta(minutes=1)),
        )
    assert same_exc.value.details == {
        "current_status": "active",
        "target_status": "active",
    }

    # 過去の更新日時への逆行を禁止する。
    with pytest.raises(DomainValidationError, match="現在の更新日時以降"):
        corp.change_status(
            CorporationStatus.DISSOLVED,
            updated_at=AwareDatetime(base_dt - timedelta(minutes=1)),
        )

    for terminal_status in (CorporationStatus.DISSOLVED, CorporationStatus.MERGED_OUT):
        terminated = corp.change_status(
            terminal_status,
            updated_at=AwareDatetime(base_dt + timedelta(minutes=10)),
        )
        assert terminated.status == terminal_status

        # 解散・合併消滅後は基本情報の変更と再遷移を禁止する。
        with pytest.raises(
            InvalidCorporationUpdateError, match="基本情報は変更できません"
        ) as upd_exc:
            terminated.update_profile(
                name=CorporationName("変更不可"),
                updated_at=AwareDatetime(base_dt + timedelta(minutes=12)),
            )
        assert upd_exc.value.details == {"current_status": terminal_status.value}

        with pytest.raises(
            InvalidCorporationTransitionError, match="存続状態は変更できません"
        ) as tr_exc:
            terminated.change_status(
                CorporationStatus.ACTIVE,
                updated_at=AwareDatetime(base_dt + timedelta(minutes=15)),
            )
        assert tr_exc.value.details == {
            "current_status": terminal_status.value,
            "target_status": "active",
        }


def test_corporate_domain_exceptions_expose_expected_codes_and_details() -> None:
    not_found = CorporationNotFoundError()
    assert isinstance(not_found, DomainNotFoundError)
    assert not_found.code == "CORPORATION_NOT_FOUND"
    assert not_found.details == {"resource": "corporation"}

    duplicate = DuplicateCorporateNumberError()
    assert isinstance(duplicate, DomainConflictError)
    assert duplicate.code == "DUPLICATE_CORPORATE_NUMBER"
    assert duplicate.details == {"field": "corporate_number"}

    empty_update = EmptyCorporationUpdateError()
    assert isinstance(empty_update, DomainValidationError)
    assert empty_update.code == "EMPTY_UPDATE"

    invalid_update = InvalidCorporationUpdateError(details={"field": "corporate_number"})
    assert isinstance(invalid_update, DomainValidationError)
    assert invalid_update.code == "INVALID_UPDATE"
    assert invalid_update.details == {"field": "corporate_number"}

    invalid_transition = InvalidCorporationTransitionError(
        "遷移不可。",
        details={"current_status": "dissolved", "target_status": "active"},
    )
    assert isinstance(invalid_transition, DomainValidationError)
    assert invalid_transition.code == "INVALID_CORPORATION_TRANSITION"
    assert invalid_transition.details == {
        "current_status": "dissolved",
        "target_status": "active",
    }
