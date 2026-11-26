"""システムベンダー認証・アカウント管理のコマンドユースケース。"""

from app.application.foundation.error_mappers import from_domain_error
from app.application.foundation.errors import (
    ApplicationAuthenticationError,
    ApplicationValidationError,
)
from app.application.foundation.ports import Clock, IdGenerator
from app.application.vendor_auth.contracts import (
    BootstrapVendorAdminInput,
    CreateVendorUserInput,
    LogoutVendorSessionInput,
    RefreshVendorSessionInput,
    VendorAuthPrincipal,
    VendorAuthSessionView,
    VendorLoginInput,
    VendorUserView,
)
from app.application.vendor_auth.mappers import to_vendor_auth_principal, to_vendor_user_view
from app.application.vendor_auth.ports import (
    JwtTokenIssuer,
    PasswordHasher,
    TokenHasher,
    VendorAuthUnitOfWorkFactory,
    VendorUserReadGateway,
)
from app.domain.foundation.exceptions import DomainError, DomainValidationError
from app.domain.foundation.primitives import AwareDatetime
from app.domain.vendor_auth.entities import (
    ACCESS_TOKEN_TTL_MINUTES,
    REFRESH_TOKEN_TTL_MINUTES,
    RefreshSession,
    VendorUser,
)
from app.domain.vendor_auth.exceptions import (
    BootstrapAdminAlreadyExistsError,
    DuplicateVendorEmailError,
    VendorUserNotFoundError,
)
from app.domain.vendor_auth.identifiers import (
    RefreshSessionId,
    RefreshTokenFamilyId,
    VendorUserId,
)
from app.domain.vendor_auth.primitives import PlainPassword, VendorDisplayName, VendorEmail
from app.domain.vendor_auth.value_objects import VendorRole, VendorTokenType

_ACCESS_TOKEN_TTL_SECONDS = ACCESS_TOKEN_TTL_MINUTES * 60
_REFRESH_TOKEN_TTL_SECONDS = REFRESH_TOKEN_TTL_MINUTES * 60
_INVALID_CREDENTIALS_MESSAGE = "メールアドレスまたはパスワードが正しくありません。"


class VendorAuthCommandService:
    """初期管理者発行・ログイン・トークン更新・ログアウトのコマンドユースケース。"""

    def __init__(
        self,
        *,
        uow_factory: VendorAuthUnitOfWorkFactory,
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

    def bootstrap_initial_admin(self, input_data: BootstrapVendorAdminInput) -> VendorUserView:
        """最初のシステムベンダー管理アカウントを発行する（既登録時は拒否）。"""
        try:
            email = VendorEmail.parse(input_data.email)
            display_name = VendorDisplayName.parse(input_data.display_name)
            password = PlainPassword.parse(input_data.password)
            password_hash = self._password_hasher.hash(password)
            now = AwareDatetime(self._clock.now())
            user_id = VendorUserId(self._id_generator.new_id())
            user = VendorUser.create_bootstrap_admin(
                user_id=user_id,
                email=email,
                display_name=display_name,
                password_hash=password_hash,
                now=now,
            )

            with self._uow_factory() as uow:
                if uow.users.count_all() > 0:
                    raise BootstrapAdminAlreadyExistsError(
                        "既にシステムベンダーユーザーが登録されているため、コンソールからの初期管理者発行は実行できません。",
                        code="BOOTSTRAP_ADMIN_ALREADY_EXISTS",
                    )
                uow.users.add(user)
                uow.commit()
            return to_vendor_user_view(user)
        except DomainError as exc:
            raise from_domain_error(exc) from exc

    def login(self, input_data: VendorLoginInput) -> VendorAuthSessionView:
        """メールアドレスとパスワードで認証し JWT セッションを発行する。"""
        if not input_data.password:
            self._password_hasher.dummy_verify()
            raise ApplicationAuthenticationError(
                _INVALID_CREDENTIALS_MESSAGE,
                code="INVALID_CREDENTIALS",
            )

        try:
            email = VendorEmail.parse(input_data.email)
        except DomainValidationError as exc:
            self._password_hasher.dummy_verify()
            raise ApplicationAuthenticationError(
                _INVALID_CREDENTIALS_MESSAGE,
                code="INVALID_CREDENTIALS",
            ) from exc

        now_dt = self._clock.now()
        now = AwareDatetime(now_dt)

        with self._uow_factory() as uow:
            user = uow.users.get_by_email(email)
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

            family_id = RefreshTokenFamilyId(self._id_generator.new_id())
            session_id = RefreshSessionId(self._id_generator.new_id())
            access_token = self._jwt_issuer.issue_access_token(
                user_id=user.id,
                role=user.role,
                token_id=self._id_generator.new_id(),
                now=now_dt,
            )
            refresh_token = self._jwt_issuer.issue_refresh_token(
                user_id=user.id,
                role=user.role,
                session_id=session_id,
                family_id=family_id,
                now=now_dt,
            )
            session = RefreshSession.issue(
                session_id=session_id,
                family_id=family_id,
                vendor_user_id=user.id,
                token_hash=self._token_hasher.hash_token(refresh_token),
                issued_at=now,
            )
            uow.refresh_sessions.add(session)
            uow.commit()

            return VendorAuthSessionView(
                user=to_vendor_user_view(user),
                access_token=access_token,
                refresh_token=refresh_token,
                access_token_expires_in_seconds=_ACCESS_TOKEN_TTL_SECONDS,
                refresh_token_expires_in_seconds=_REFRESH_TOKEN_TTL_SECONDS,
            )

    def refresh(self, input_data: RefreshVendorSessionInput) -> VendorAuthSessionView:
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
            expected_type=VendorTokenType.REFRESH,
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

            user = uow.users.get_by_id(session.vendor_user_id)
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

            next_session_id = RefreshSessionId(self._id_generator.new_id())
            access_token = self._jwt_issuer.issue_access_token(
                user_id=user.id,
                role=user.role,
                token_id=self._id_generator.new_id(),
                now=now_dt,
            )
            next_refresh_token = self._jwt_issuer.issue_refresh_token(
                user_id=user.id,
                role=user.role,
                session_id=next_session_id,
                family_id=session.family_id,
                now=now_dt,
            )
            next_session = RefreshSession.issue(
                session_id=next_session_id,
                family_id=session.family_id,
                vendor_user_id=user.id,
                token_hash=self._token_hasher.hash_token(next_refresh_token),
                issued_at=now,
            )
            session.rotate(replaced_by_session_id=next_session_id, now=now)
            uow.refresh_sessions.save(session)
            uow.refresh_sessions.add(next_session)
            uow.commit()

            return VendorAuthSessionView(
                user=to_vendor_user_view(user),
                access_token=access_token,
                refresh_token=next_refresh_token,
                access_token_expires_in_seconds=_ACCESS_TOKEN_TTL_SECONDS,
                refresh_token_expires_in_seconds=_REFRESH_TOKEN_TTL_SECONDS,
            )

    def logout(self, input_data: LogoutVendorSessionInput) -> None:
        """ログアウト時に該当セッションファミリーを即時失効させる。"""
        raw_token = (input_data.refresh_token or "").strip()
        if not raw_token:
            return

        now_dt = self._clock.now()
        now = AwareDatetime(now_dt)
        try:
            claims = self._jwt_issuer.verify_token(
                raw_token,
                expected_type=VendorTokenType.REFRESH,
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
        uow_factory: VendorAuthUnitOfWorkFactory,
        clock: Clock,
        id_generator: IdGenerator,
        password_hasher: PasswordHasher,
    ) -> None:
        self._uow_factory = uow_factory
        self._clock = clock
        self._id_generator = id_generator
        self._password_hasher = password_hasher

    def create_vendor_user(
        self, actor_id: str, input_data: CreateVendorUserInput
    ) -> VendorUserView:
        """ベンダー管理者が新しい社員アカウントを発行する。"""
        try:
            actor_user_id = VendorUserId.parse(actor_id)
            email = VendorEmail.parse(input_data.email)
            display_name = VendorDisplayName.parse(input_data.display_name)
            password = PlainPassword.parse(input_data.password)
            try:
                role = VendorRole(input_data.role)
            except ValueError as exc:
                raise ApplicationValidationError(
                    "ロールは admin または member を指定してください。",
                    code="INVALID_VENDOR_ROLE",
                ) from exc

            password_hash = self._password_hasher.hash(password)
            now = AwareDatetime(self._clock.now())
            new_user_id = VendorUserId(self._id_generator.new_id())

            with self._uow_factory() as uow:
                actor = uow.users.get_by_id(actor_user_id)
                if actor is None:
                    raise VendorUserNotFoundError(
                        "操作者アカウントが見つかりません。",
                        code="VENDOR_USER_NOT_FOUND",
                    )
                actor.ensure_can_manage_vendor_users()

                if uow.users.get_by_email(email) is not None:
                    raise DuplicateVendorEmailError(
                        "このメールアドレスのベンダーユーザーは既に登録されています。",
                        code="DUPLICATE_VENDOR_EMAIL",
                    )

                new_user = VendorUser.create_by_admin(
                    actor=actor,
                    user_id=new_user_id,
                    email=email,
                    display_name=display_name,
                    role=role,
                    password_hash=password_hash,
                    now=now,
                )
                uow.users.add(new_user)
                uow.commit()

            return to_vendor_user_view(new_user)
        except DomainError as exc:
            raise from_domain_error(exc) from exc


class VendorTokenVerifierService:
    """アクセストークン検証と最新ユーザー状態確認を行うサービス。"""

    def __init__(
        self,
        *,
        jwt_issuer: JwtTokenIssuer,
        read_gateway: VendorUserReadGateway,
        clock: Clock,
    ) -> None:
        self._jwt_issuer = jwt_issuer
        self._read_gateway = read_gateway
        self._clock = clock

    def verify_access_token(self, raw_token: str) -> VendorAuthPrincipal:
        """アクセストークンを検証し、有効な認証主体を返す。"""
        if not raw_token.strip():
            raise ApplicationAuthenticationError(
                "認証が必要です。",
                code="UNAUTHORIZED",
            )
        claims = self._jwt_issuer.verify_token(
            raw_token,
            expected_type=VendorTokenType.ACCESS,
            now=self._clock.now(),
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
        return to_vendor_auth_principal(user)
