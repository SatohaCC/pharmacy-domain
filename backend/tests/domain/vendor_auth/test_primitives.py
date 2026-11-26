"""VendorAuth ドメイン Primitive の単体テスト。"""

import pytest

from app.domain.foundation.exceptions import DomainValidationError
from app.domain.vendor_auth.primitives import (
    PlainPassword,
    TokenHash,
    VendorDisplayName,
    VendorEmail,
)


def test_vendor_email_normalizes_and_masks() -> None:
    email = VendorEmail.parse("  Admin.User@Example.COM  ")

    assert email.value == "admin.user@example.com"
    assert str(email) == "***"
    assert repr(email) == "VendorEmail('***')"


@pytest.mark.parametrize(
    "raw",
    [
        "",
        "   ",
        "not-an-email",
        "user@",
        "@example.com",
        "user@localhost",
        "user name@example.com",
        "user\n@example.com",
    ],
)
def test_vendor_email_rejects_invalid_formats(raw: str) -> None:
    with pytest.raises(DomainValidationError):
        VendorEmail.parse(raw)


def test_vendor_display_name_validation() -> None:
    name = VendorDisplayName.parse("  運用 管理者  ")
    assert name.value == "運用 管理者"

    with pytest.raises(DomainValidationError):
        VendorDisplayName.parse("a" * 101)
    with pytest.raises(DomainValidationError):
        VendorDisplayName.parse("bad\x00name")


def test_plain_password_accepts_guideline_compliant_passwords() -> None:
    pw3 = PlainPassword.parse("Abcdefgh12345")
    pw4 = PlainPassword.parse("Abcdefgh1234!")
    assert pw3.value == "Abcdefgh12345"
    assert pw4.value == "Abcdefgh1234!"
    assert str(pw4) == "***"


@pytest.mark.parametrize(
    "raw",
    [
        "Short123!",  # 13文字未満
        "A" * 129,  # 128文字超
        " Abcdefgh1234!",  # 先頭空白
        "Abcdefgh1234! ",  # 末尾空白
        "Abcdefgh1234\n!",  # 制御文字
        "abcdefghijklm",  # 1種類のみ
        "abcdefg123456",  # 2種類のみ（小文字+数字）
        "ABCDEFG123456",  # 2種類のみ（大文字+数字）
    ],
)
def test_plain_password_rejects_non_compliant_passwords(raw: str) -> None:
    with pytest.raises(DomainValidationError):
        PlainPassword.parse(raw)


def test_token_hash_requires_64_lowercase_hex() -> None:
    valid = TokenHash("a" * 64)
    assert valid.value == "a" * 64

    with pytest.raises(DomainValidationError):
        TokenHash("A" * 64)
    with pytest.raises(DomainValidationError):
        TokenHash("abc")
