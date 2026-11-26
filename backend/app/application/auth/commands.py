"""共通認証・スコープ付きロール管理のコマンドユースケース。"""

from app.application.auth.contracts import (
    AuthLoginInput,
    AuthPrincipal,
    AuthSessionView,
    AuthUserView,
    BootstrapVendorAdminInput,
    CreateVendorUserInput,
    LogoutAuthSessionInput,
    RefreshAuthSessionInput,
)
from app.application.auth.mappers import (
    extract_role_names,
    to_auth_principal,
    to_auth_user_view,
)
from app.application.auth.ports import (
    AuthUnitOfWorkFactory,
    AuthUserReadGateway,
    JwtTokenIssuer,
    PasswordHasher,
    TokenHasher,
)
from app.application.foundation.error_mappers import from_domain_error
from app.application.foundation.errors import (
    ApplicationAuthenticationError,
    ApplicationAuthorizationError,
    ApplicationValidationError,
)
from app.application.foundation.ports import Clock, IdGenerator
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
)
from app.domain.auth.identifiers import (
    RefreshSessionId,
    RefreshTokenFamilyId,
    RoleAssignmentId,
    TenantId,
    UserId,
)
from app.domain.auth.primitives import PlainPassword, UserDisplayName, UserEmail
from app.domain.auth.value_objects import AffiliationType, AuthScope, RoleName, TokenType
from app.domain.foundation.exceptions import DomainError, DomainValidationError
from app.domain.foundation.primitives import AwareDatetime

_ACCESS_TOKEN_TTL_SECONDS = ACCESS_TOKEN_TTL_MINUTES * 60
_REFRESH_TOKEN_TTL_SECONDS = REFRESH_TOKEN_TTL_MINUTES * 60
_INVALID_CREDENTIALS_MESSAGE = "メールアドレスまたはパスワードが正しくありません。"


def _build_scope(scope_type: str, tenant_id: str | None) -> AuthScope:
    if scope_type == AffiliationType.VENDOR.value:
        if tenant_id is not None:
            raise ApplicationValidationError(
                "ベンダースコープでは tenant_id を指定できません。",
                code="INVALID_ROLE_SCOPE",
            )
        return AuthScope.vendor()
    if scope_type == AffiliationType.TENANT.value:
        if not tenant_id:
            raise ApplicationValidationError(
                "テナントスコープでは tenant_id が必須です。",
                code="INVALID_ROLE_SCOPE",
            )
        return AuthScope.tenant(TenantId.parse(tenant_id))
    raise ApplicationValidationError(
        "不正なスコープ種別です。",
        code="INVALID_ROLE_SCOPE",
    )


class AuthCommandService:
    """初期ベンダー管理者発行・ログイン・トークン更新・ログアウトのコマンドユースケース。"""

    def __init__(
        self,
        *,
        uow_factory: AuthUnitOfWorkFactory,
        clock: Clock,
        id_generator: IdGenerator,
        password_hasher: PasswordHasher,
        token_hasher: TokenHasher,
        jwt_issuer: JwtTokenIssuer,
    ) -> None:
        self._uow_factory = uow_factory
        self._clock = clock
        self._id_generator = id_generator
        self._password_hasher = password_hasher
        self._token_hasher = token_hasher
        self._jwt_issuer = jwt_issuer

    def bootstrap_initial_vendor_admin(self, input_data: BootstrapVendorAdminInput) -> AuthUserView:
        """最初のシステムベンダー管理アカウントを発行する（既登録時は拒否）。"""
        try:
            email = UserEmail.parse(input_data.email)
            display_name = UserDisplayName.parse(input_data.display_name)
            password = PlainPassword.parse(input_data.password)
            password_hash = self._password_hasher.hash(password)
            now = AwareDatetime(self._clock.now())
            user_id = UserId(self._id_generator.new_id())
            user = User.create_bootstrap_vendor_admin(
                user_id=user_id,
                email=email,
                display_name=display_name,
                password_hash=password_hash,
                now=now,
            )
            assignment = RoleAssignment.grant_to_user(
                assignment_id=RoleAssignmentId(self._id_generator.new_id()),
                user=user,
                role=RoleName.VENDOR_ADMIN,
                scope=AuthScope.vendor(),
                valid_from=now,
                valid_to=None,
                granted_at=now,
                granted_by=None,
            )

            with self._uow_factory() as uow:
                if uow.users.count_by_affiliation(AffiliationType.VENDOR) > 0:
                    raise BootstrapAdminAlreadyExistsError(
                        "既にシステムベンダーユーザーが登録されているため、"
                        "コンソールからの初期管理者発行は実行できません。",
                        code="BOOTSTRAP_ADMIN_ALREADY_EXISTS",
                    )
                uow.users.add(user)
                uow.role_assignments.add(assignment)
                uow.commit()
            return to_auth_user_view(user, (assignment,))
        except DomainError as exc:
            raise from_domain_error(exc) from exc

    def login(self, input_data: AuthLoginInput) -> AuthSessionView:
        """メールアドレスとパスワードで認証し JWT セッションを発行する。"""
        if not input_data.password:
            self._password_hasher.dummy_verify()
            raise ApplicationAuthenticationError(
                _INVALID_CREDENTIALS_MESSAGE,
                code="INVALID_CREDENTIALS",
            )

        try:
            scope = _build_scope(input_data.scope_type, input_data.tenant_id)
            email = UserEmail.parse(input_data.email)
        except (DomainValidationError, ApplicationValidationError) as exc:
            self._password_hasher.dummy_verify()
            raise ApplicationAuthenticationError(
                _INVALID_CREDENTIALS_MESSAGE,
                code="INVALID_CREDENTIALS",
            ) from exc

        now_dt = self._clock.now()
        now = AwareDatetime(now_dt)

        with self._uow_factory() as uow:
            user = uow.users.get_by_email_in_scope(email, scope)
            if user is None:
                self._password_hasher.dummy_verify()
                raise ApplicationAuthenticationError(
                    _INVALID_CREDENTIALS_MESSAGE,
                    code="INVALID_CREDENTIALS",
                )

            if not self._password_hasher.verify(input_data.password, user.password_hash):
                raise ApplicationAuthenticationError(
                    _INVALID_CREDENTIALS_MESSAGE,
                    code="INVALID_CREDENTIALS",
                )

            try:
                user.ensure_can_authenticate()
            except DomainError as exc:
                raise from_domain_error(exc) from exc

            assignments = uow.role_assignments.list_active_for_user(user.id, now)
            role_names = extract_role_names(assignments)

            family_id = RefreshTokenFamilyId(self._id_generator.new_id())
            session_id = RefreshSessionId(self._id_generator.new_id())
            access_token = self._jwt_issuer.issue_access_token(
                user_id=user.id,
                scope=user.affiliation,
                roles=role_names,
                token_id=self._id_generator.new_id(),
                now=now_dt,
            )
            refresh_token = self._jwt_issuer.issue_refresh_token(
                user_id=user.id,
                scope=user.affiliation,
                roles=role_names,
                session_id=session_id,
                family_id=family_id,
                now=now_dt,
            )
            session = RefreshSession.issue(
                session_id=session_id,
                family_id=family_id,
                user_id=user.id,
                scope=user.affiliation,
                token_hash=self._token_hasher.hash_token(refresh_token),
                issued_at=now,
            )
            uow.refresh_sessions.add(session)
            uow.commit()

            return AuthSessionView(
                user=to_auth_user_view(user, assignments),
                access_token=access_token,
                refresh_token=refresh_token,
                access_token_expires_in_seconds=_ACCESS_TOKEN_TTL_SECONDS,
                refresh_token_expires_in_seconds=_REFRESH_TOKEN_TTL_SECONDS,
            )

    def refresh(self, input_data: RefreshAuthSessionInput) -> AuthSessionView:
        """リフレッシュトークンを検証・ローテーションし、再利用時はファミリー全体を失効させる。"""
        if not input_data.refresh_token.strip():
            raise ApplicationAuthenticationError(
                "リフレッシュトークンがありません。",
                code="REFRESH_TOKEN_INVALID",
            )

        now_dt = self._clock.now()
        now = AwareDatetime(now_dt)
        claims = self._jwt_issuer.verify_token(
            input_data.refresh_token,
            expected_type=TokenType.REFRESH,
            now=now_dt,
        )
        session_id = RefreshSessionId(claims.token_id)
        presented_hash = self._token_hasher.hash_token(input_data.refresh_token)

        with self._uow_factory() as uow:
            session = uow.refresh_sessions.get_by_id(session_id)
            if session is None or session.token_hash != presented_hash:
                raise ApplicationAuthenticationError(
                    "リフレッシュトークンが無効です。",
                    code="REFRESH_TOKEN_INVALID",
                )

            if session.is_reused() or session.is_revoked():
                # 再利用を検知したためファミリー全体を失効させる。
                uow.refresh_sessions.revoke_family(session.family_id, now)
                uow.commit()
                raise ApplicationAuthenticationError(
                    "セッションが無効化されました。再度ログインしてください。",
                    code="REFRESH_TOKEN_REVOKED",
                )

            if session.is_expired(now):
                session.revoke(now)
                uow.refresh_sessions.save(session)
                uow.commit()
                raise ApplicationAuthenticationError(
                    "セッションの有効期限が切れました。再度ログインしてください。",
                    code="AUTH_TOKEN_EXPIRED",
                )

            user = uow.users.get_by_id(session.user_id)
            if user is None:
                uow.refresh_sessions.revoke_family(session.family_id, now)
                uow.commit()
                raise ApplicationAuthenticationError(
                    "セッションが無効です。",
                    code="REFRESH_TOKEN_INVALID",
                )

            try:
                user.ensure_can_authenticate()
            except DomainError as exc:
                uow.refresh_sessions.revoke_family(session.family_id, now)
                uow.commit()
                raise ApplicationAuthenticationError(
                    "アカウントが無効化されているためセッションを継続できません。",
                    code="REFRESH_TOKEN_REVOKED",
                ) from exc

            assignments = uow.role_assignments.list_active_for_user(user.id, now)
            role_names = extract_role_names(assignments)

            next_session_id = RefreshSessionId(self._id_generator.new_id())
            access_token = self._jwt_issuer.issue_access_token(
                user_id=user.id,
                scope=session.scope,
                roles=role_names,
                token_id=self._id_generator.new_id(),
                now=now_dt,
            )
            next_refresh_token = self._jwt_issuer.issue_refresh_token(
                user_id=user.id,
                scope=session.scope,
                roles=role_names,
                session_id=next_session_id,
                family_id=session.family_id,
                now=now_dt,
            )
            next_session = RefreshSession.issue(
                session_id=next_session_id,
                family_id=session.family_id,
                user_id=user.id,
                scope=session.scope,
                token_hash=self._token_hasher.hash_token(next_refresh_token),
                issued_at=now,
            )
            session.rotate(replaced_by_session_id=next_session_id, now=now)
            uow.refresh_sessions.save(session)
            uow.refresh_sessions.add(next_session)
            uow.commit()

            return AuthSessionView(
                user=to_auth_user_view(user, assignments),
                access_token=access_token,
                refresh_token=next_refresh_token,
                access_token_expires_in_seconds=_ACCESS_TOKEN_TTL_SECONDS,
                refresh_token_expires_in_seconds=_REFRESH_TOKEN_TTL_SECONDS,
            )

    def logout(self, input_data: LogoutAuthSessionInput) -> None:
        """ログアウト時に該当セッションファミリーを即時失効させる。"""
        raw_token = (input_data.refresh_token or "").strip()
        if not raw_token:
            return

        now_dt = self._clock.now()
        now = AwareDatetime(now_dt)
        try:
            claims = self._jwt_issuer.verify_token(
                raw_token,
                expected_type=TokenType.REFRESH,
                now=now_dt,
            )
        except ApplicationAuthenticationError:
            return

        session_id = RefreshSessionId(claims.token_id)
        with self._uow_factory() as uow:
            session = uow.refresh_sessions.get_by_id(session_id)
            if session is not None:
                uow.refresh_sessions.revoke_family(session.family_id, now)
                uow.commit()


class VendorUserCommandService:
    """ベンダー社員アカウント管理のコマンドユースケース。"""

    def __init__(
        self,
        *,
        uow_factory: AuthUnitOfWorkFactory,
        clock: Clock,
        id_generator: IdGenerator,
        password_hasher: PasswordHasher,
    ) -> None:
        self._uow_factory = uow_factory
        self._clock = clock
        self._id_generator = id_generator
        self._password_hasher = password_hasher

    def create_vendor_user(self, actor_id: str, input_data: CreateVendorUserInput) -> AuthUserView:
        """ベンダー管理者が新しいベンダー社員アカウントを発行しロールを付与する。"""
        try:
            actor_user_id = UserId.parse(actor_id)
            email = UserEmail.parse(input_data.email)
            display_name = UserDisplayName.parse(input_data.display_name)
            password = PlainPassword.parse(input_data.password)

            if not input_data.roles:
                raise ApplicationValidationError(
                    "付与するロールを 1 つ以上指定してください。",
                    code="INVALID_VENDOR_ROLE",
                )

            parsed_roles: list[RoleName] = []
            for raw_role in input_data.roles:
                try:
                    role_name = RoleName(raw_role)
                except ValueError as exc:
                    raise ApplicationValidationError(
                        "不正なロールが指定されました。",
                        code="INVALID_VENDOR_ROLE",
                    ) from exc
                if role_name.allowed_scope_type() != AffiliationType.VENDOR:
                    raise ApplicationValidationError(
                        "ベンダー社員にはベンダー用ロールのみ指定できます。",
                        code="INVALID_ROLE_SCOPE",
                    )
                if role_name not in parsed_roles:
                    parsed_roles.append(role_name)

            password_hash = self._password_hasher.hash(password)
            now = AwareDatetime(self._clock.now())
            new_user_id = UserId(self._id_generator.new_id())
            vendor_scope = AuthScope.vendor()

            with self._uow_factory() as uow:
                actor = uow.users.get_by_id(actor_user_id)
                if actor is None:
                    raise AuthUserNotFoundError(
                        "操作者アカウントが見つかりません。",
                        code="AUTH_USER_NOT_FOUND",
                    )
                actor_roles = uow.role_assignments.list_active_for_user(actor.id, now)
                if (
                    actor.affiliation != vendor_scope
                    or RoleName.VENDOR_ADMIN not in extract_role_names(actor_roles)
                ):
                    raise ApplicationAuthorizationError(
                        "この操作にはシステムベンダー管理者権限が必要です。",
                        code="VENDOR_ADMIN_REQUIRED",
                    )
                try:
                    actor.ensure_can_authenticate()
                except DomainError as exc:
                    raise ApplicationAuthorizationError(
                        "この操作にはシステムベンダー管理者権限が必要です。",
                        code="VENDOR_ADMIN_REQUIRED",
                    ) from exc

                if uow.users.get_by_email_in_scope(email, vendor_scope) is not None:
                    raise DuplicateUserEmailError(
                        "このメールアドレスのベンダーユーザーは既に登録されています。",
                        code="DUPLICATE_VENDOR_EMAIL",
                    )

                new_user = User.create_vendor_user(
                    actor_id=actor.id,
                    user_id=new_user_id,
                    email=email,
                    display_name=display_name,
                    password_hash=password_hash,
                    now=now,
                )
                assignments = tuple(
                    RoleAssignment.grant_to_user(
                        assignment_id=RoleAssignmentId(self._id_generator.new_id()),
                        user=new_user,
                        role=role_name,
                        scope=vendor_scope,
                        valid_from=now,
                        valid_to=None,
                        granted_at=now,
                        granted_by=actor.id,
                    )
                    for role_name in parsed_roles
                )
                uow.users.add(new_user)
                for assignment in assignments:
                    uow.role_assignments.add(assignment)
                uow.commit()

            return to_auth_user_view(new_user, assignments)
        except DomainError as exc:
            raise from_domain_error(exc) from exc


class AuthTokenVerifierService:
    """アクセストークン検証と最新ユーザー状態・最新ロール確認を行うサービス。"""

    def __init__(
        self,
        *,
        jwt_issuer: JwtTokenIssuer,
        read_gateway: AuthUserReadGateway,
        clock: Clock,
    ) -> None:
        self._jwt_issuer = jwt_issuer
        self._read_gateway = read_gateway
        self._clock = clock

    def verify_access_token(self, raw_token: str) -> AuthPrincipal:
        """アクセストークンを検証し、有効な認証主体と最新ロール一覧を返す。"""
        if not raw_token.strip():
            raise ApplicationAuthenticationError(
                "認証が必要です。",
                code="UNAUTHORIZED",
            )
        now_dt = self._clock.now()
        claims = self._jwt_issuer.verify_token(
            raw_token,
            expected_type=TokenType.ACCESS,
            now=now_dt,
        )
        user = self._read_gateway.get_by_id(claims.subject)
        if user is None:
            raise ApplicationAuthenticationError(
                "認証情報が無効です。再度ログインしてください。",
                code="AUTH_TOKEN_INVALID",
            )
        try:
            user.ensure_can_authenticate()
        except DomainError as exc:
            raise from_domain_error(exc) from exc

        assignments = self._read_gateway.list_active_roles_for_user(user.id.value, now_dt)
        return to_auth_principal(user, assignments)
