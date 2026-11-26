"""共通認証・スコープ付きロール管理ドメイン。"""

from app.domain.auth.entities import (
    ACCESS_TOKEN_TTL_MINUTES,
    REFRESH_TOKEN_TTL_MINUTES,
    RefreshSession,
    RoleAssignment,
    User,
)
from app.domain.auth.exceptions import (
    AuthUserNotFoundError,
    BootstrapAdminAlreadyExistsError,
    DuplicateUserEmailError,
    InsufficientRoleError,
    InvalidCredentialsError,
    RefreshSessionInvalidError,
    ScopeViolationError,
)
from app.domain.auth.identifiers import (
    RefreshSessionId,
    RefreshTokenFamilyId,
    RoleAssignmentId,
    TenantId,
    UserId,
)
from app.domain.auth.primitives import (
    PasswordHash,
    PlainPassword,
    TokenHash,
    UserDisplayName,
    UserEmail,
)
from app.domain.auth.repositories import (
    AuthUserRepository,
    RefreshSessionRepository,
    RoleAssignmentRepository,
)
from app.domain.auth.value_objects import (
    AffiliationType,
    AuthScope,
    RoleName,
    TokenType,
    UserStatus,
)

__all__ = [
    "ACCESS_TOKEN_TTL_MINUTES",
    "AffiliationType",
    "AuthScope",
    "AuthUserNotFoundError",
    "AuthUserRepository",
    "BootstrapAdminAlreadyExistsError",
    "DuplicateUserEmailError",
    "InsufficientRoleError",
    "InvalidCredentialsError",
    "PasswordHash",
    "PlainPassword",
    "REFRESH_TOKEN_TTL_MINUTES",
    "RefreshSession",
    "RefreshSessionId",
    "RefreshSessionInvalidError",
    "RefreshSessionRepository",
    "RefreshTokenFamilyId",
    "RoleAssignment",
    "RoleAssignmentId",
    "RoleAssignmentRepository",
    "RoleName",
    "ScopeViolationError",
    "TenantId",
    "TokenHash",
    "TokenType",
    "User",
    "UserDisplayName",
    "UserEmail",
    "UserId",
    "UserStatus",
]
