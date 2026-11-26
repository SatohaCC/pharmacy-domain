"""共通認証ドメイン Primitive の単体テスト。"""

import pytest

from app.domain.auth.primitives import (
    PlainPassword,
    TokenHash,
    UserDisplayName,
    UserEmail,
)
from app.domain.foundation.exceptions import DomainValidationError


def test_user_email_normalizes_and_masks() -> None:
    email = UserEmail.parse("  Admin.User@Example.COM  ")

    assert email.value == "admin.user@example.com"
    assert str(email) == "***"
    assert repr(email) == "UserEmail('***')"


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
def test_user_email_rejects_invalid_formats(raw: str) -> None:
    with pytest.raises(DomainValidationError):
        UserEmail.parse(raw)


def test_user_display_name_validation() -> None:
    name = UserDisplayName.parse("  運用 管理者  ")
    assert name.value == "運用 管理者"

    with pytest.raises(DomainValidationError):
        UserDisplayName.parse("a" * 101)
    with pytest.raises(DomainValidationError):
        UserDisplayName.parse("bad\x00name")


def test_plain_password_accepts_guideline_compliant_passwords() -> None:
    pw3 = PlainPassword.parse("Abcdefgh12345")
    pw4 = PlainPassword.parse("Abcdefgh1234!")
    assert pw3.value == "Abcdefgh12345"
    assert pw4.value == "Abcdefgh1234!"
    assert str(pw4) == "***"


@pytest.mark.parametrize(
    "raw",
    [
        "Short123!",
        "A" * 129,
        " Abcdefgh1234!",
        "Abcdefgh1234! ",
        "Abcdefgh1234\n!",
        "abcdefghijklm",
        "abcdefg123456",
        "ABCDEFG123456",
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
