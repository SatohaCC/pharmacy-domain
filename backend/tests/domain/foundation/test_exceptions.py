"""domain/foundation/exceptions の単体テスト。"""

from typing import Any, cast

import pytest

from app.domain.foundation.exceptions import (
    DomainAuthorizationError,
    DomainConflictError,
    DomainError,
    DomainNotFoundError,
    DomainValidationError,
)


def test_domain_error_keeps_minimal_attributes_and_immutable_details() -> None:
    err = DomainValidationError(
        "法人番号は 13 桁の半角数字で指定してください。",
        code="INVALID_CORPORATE_NUMBER",
        details={"field": "corporate_number", "length": 13, "nullable": False},
    )

    assert err.code == "INVALID_CORPORATE_NUMBER"
    assert err.message == "法人番号は 13 桁の半角数字で指定してください。"
    assert dict(err.details) == {
        "field": "corporate_number",
        "length": 13,
        "nullable": False,
    }
    with pytest.raises(TypeError):
        cast(Any, err.details)["field"] = "mutated"

    assert DomainValidationError("検証エラー").code == "VALIDATION_ERROR"
    assert DomainNotFoundError("未検出").code == "NOT_FOUND"
    assert DomainConflictError("競合").code == "CONFLICT"
    assert DomainError("汎用").code == "DOMAIN_ERROR"

    auth_err = DomainAuthorizationError("アクセス不可", conceal_as_not_found=True)
    assert auth_err.code == "FORBIDDEN"
    assert auth_err.conceal_as_not_found is True
