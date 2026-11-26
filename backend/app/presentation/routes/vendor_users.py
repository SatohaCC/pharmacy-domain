"""ベンダー社員アカウント管理 API ルーター。"""

from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.application.auth.contracts import (
    AuthPrincipal,
    AuthUserQueryPort,
    VendorUserCommandPort,
)
from app.presentation.dependencies import (
    get_auth_user_queries,
    get_vendor_user_commands,
    require_role,
    verify_csrf_origin,
)
from app.presentation.dto.auth import (
    AuthUserListResponse,
    AuthUserResponse,
    CreateVendorUserV2Request,
)
from app.presentation.dto.error import ErrorResponse
from app.presentation.mappers.auth import (
    to_auth_user_list_response,
    to_auth_user_response,
    to_create_vendor_user_v2_input,
)

router = APIRouter(prefix="/api/vendor/users", tags=["vendor-users"])


@router.get(
    "",
    response_model=AuthUserListResponse,
    responses={401: {"model": ErrorResponse}, 403: {"model": ErrorResponse}},
)
def list_vendor_users(
    principal: Annotated[
        AuthPrincipal,
        Depends(require_role("vendor_admin", scope_type="vendor")),
    ],
    queries: Annotated[AuthUserQueryPort, Depends(get_auth_user_queries)],
) -> AuthUserListResponse:
    """ベンダー所属ユーザー一覧を返す（vendor_admin のみ）。"""
    return to_auth_user_list_response(queries.list_vendor_users(principal.user_id))


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=AuthUserResponse,
    responses={
        401: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
        409: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
    },
    dependencies=[Depends(verify_csrf_origin)],
)
def create_vendor_user(
    payload: CreateVendorUserV2Request,
    principal: Annotated[
        AuthPrincipal,
        Depends(require_role("vendor_admin", scope_type="vendor")),
    ],
    commands: Annotated[VendorUserCommandPort, Depends(get_vendor_user_commands)],
) -> AuthUserResponse:
    """Web 管理画面からベンダー社員アカウントを発行する（vendor_admin のみ）。"""
    created = commands.create_vendor_user(
        principal.user_id,
        to_create_vendor_user_v2_input(payload),
    )
    return to_auth_user_response(created)
