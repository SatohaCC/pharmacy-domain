"""application/foundation/error_mappers の単体テスト。"""

from app.application.foundation.error_mappers import from_domain_error
from app.application.foundation.errors import (
    ApplicationAuthorizationError,
    ApplicationConflictError,
    ApplicationError,
    ApplicationNotFoundError,
    ApplicationValidationError,
)
from app.domain.foundation.exceptions import (
    DomainAuthorizationError,
    DomainConflictError,
    DomainError,
    DomainNotFoundError,
    DomainValidationError,
)


def test_from_domain_error_preserves_metadata_and_maps_categories() -> None:
    cases: list[tuple[DomainError, type[ApplicationError], str]] = [
        (
            DomainNotFoundError(
                "対象が見つかりません。",
                code="CORPORATION_NOT_FOUND",
                details={"resource": "corporation"},
            ),
            ApplicationNotFoundError,
            "CORPORATION_NOT_FOUND",
        ),
        (
            DomainConflictError(
                "法人番号が重複しています。",
                code="DUPLICATE_CORPORATE_NUMBER",
                details={"field": "corporate_number"},
            ),
            ApplicationConflictError,
            "DUPLICATE_CORPORATE_NUMBER",
        ),
        (
            DomainAuthorizationError(
                "他店舗データにはアクセスできません。",
                code="CROSS_TENANT_ACCESS",
                conceal_as_not_found=True,
            ),
            ApplicationAuthorizationError,
            "CROSS_TENANT_ACCESS",
        ),
        (
            DomainValidationError("形式が不正です。"),
            ApplicationValidationError,
            "VALIDATION_ERROR",
        ),
        (
            DomainError("汎用ドメインエラー。"),
            ApplicationError,
            "DOMAIN_ERROR",
        ),
    ]

    for domain_err, expected_type, expected_code in cases:
        app_err = from_domain_error(domain_err, state_impact="draft_preserved")
        assert isinstance(app_err, expected_type)
        assert app_err.code == expected_code
        assert app_err.message == domain_err.message
        assert dict(app_err.details) == dict(domain_err.details)
        assert app_err.state_impact == "draft_preserved"

    auth_app_err = from_domain_error(
        DomainAuthorizationError("アクセス不可", conceal_as_not_found=True)
    )
    assert isinstance(auth_app_err, ApplicationAuthorizationError)
    assert auth_app_err.conceal_as_not_found is True
