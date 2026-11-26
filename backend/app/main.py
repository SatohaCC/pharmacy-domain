"""Composition Root: 全層を組み立てて FastAPI アプリケーションを起動する。"""

import inspect
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.engine import Engine

from app.application.auth.commands import (
    AuthCommandService,
    AuthTokenVerifierService,
    VendorUserCommandService,
)
from app.application.auth.queries import AuthUserQueryService
from app.application.corporate.commands import CorporationCommandService
from app.application.corporate.queries import CorporationQueryService
from app.application.corporate.relation_commands import CorporateRelationCommandService
from app.application.corporate.relation_queries import CorporateRelationQueryService
from app.infrastructure.clock import SystemClock, Uuid4Generator
from app.infrastructure.config import Settings, load_settings
from app.infrastructure.logging import configure_logging, request_id_context
from app.infrastructure.persistence.auth_unit_of_work import SqlAlchemyAuthUnitOfWorkFactory
from app.infrastructure.persistence.auth_user_query import SqlAlchemyAuthUserReadGateway
from app.infrastructure.persistence.corporate_relation_query import (
    SqlAlchemyCorporateRelationQueryPort,
)
from app.infrastructure.persistence.corporation_query import SqlAlchemyCorporationQueryPort
from app.infrastructure.persistence.database import create_app_engine
from app.infrastructure.persistence.unit_of_work import SqlAlchemyCorporationUnitOfWorkFactory
from app.infrastructure.resources import ResourceRegistry
from app.infrastructure.security.jwt_codec import Hs256JwtTokenIssuer, Sha256TokenHasher
from app.infrastructure.security.password_hasher import ScryptPasswordHasher
from app.presentation.error_handlers import REQUEST_ID_HEADER, register_exception_handlers
from app.presentation.middleware import AccessLogMiddleware, RequestIdMiddleware
from app.presentation.routes import corporations_router, health_router
from app.presentation.routes.auth import router as auth_router
from app.presentation.routes.corporate_relations import router as corporate_relations_router
from app.presentation.routes.vendor_auth import router as vendor_auth_router

APP_ENGINE_RESOURCE_NAME = "app_engine"

type ResourceStartupHook = Callable[[FastAPI, ResourceRegistry], Awaitable[None] | None]


def create_app(
    settings: Settings | None = None,
    *,
    resource_startup: ResourceStartupHook | None = None,
) -> FastAPI:
    """設定を受け取って FastAPI アプリケーションを生成・配線する。"""
    resolved_settings = settings or load_settings()
    logger = configure_logging(resolved_settings.log_level)

    @asynccontextmanager
    async def lifespan(application: FastAPI) -> AsyncIterator[None]:
        registry = getattr(application.state, "resources", None)
        if not isinstance(registry, ResourceRegistry):
            registry = ResourceRegistry()
            application.state.resources = registry

        try:
            if resource_startup is not None:
                maybe_coro = resource_startup(application, registry)
                if inspect.isawaitable(maybe_coro):
                    await maybe_coro

            if APP_ENGINE_RESOURCE_NAME not in registry:
                registry.register(
                    APP_ENGINE_RESOURCE_NAME,
                    create_app_engine(resolved_settings.database_path),
                )

            engine = registry.require(APP_ENGINE_RESOURCE_NAME, Engine)
            uow_factory = SqlAlchemyCorporationUnitOfWorkFactory(engine)
            clock = SystemClock()
            id_generator = Uuid4Generator()
            application.state.corporation_commands = CorporationCommandService(
                uow_factory=uow_factory,
                clock=clock,
                id_generator=id_generator,
            )
            application.state.corporation_queries = CorporationQueryService(
                query_gateway=SqlAlchemyCorporationQueryPort(engine),
            )
            application.state.corporate_relation_commands = CorporateRelationCommandService(
                uow_factory=uow_factory,
                clock=clock,
                id_generator=id_generator,
            )
            application.state.corporate_relation_queries = CorporateRelationQueryService(
                SqlAlchemyCorporateRelationQueryPort(engine),
            )

            auth_uow_factory = SqlAlchemyAuthUnitOfWorkFactory(engine)
            auth_read_gateway = SqlAlchemyAuthUserReadGateway(engine)
            password_hasher = ScryptPasswordHasher()
            token_hasher = Sha256TokenHasher()
            jwt_issuer = Hs256JwtTokenIssuer(
                secret_key=resolved_settings.jwt_secret_key,
                issuer=resolved_settings.jwt_issuer,
            )
            application.state.auth_commands = AuthCommandService(
                uow_factory=auth_uow_factory,
                clock=clock,
                id_generator=id_generator,
                password_hasher=password_hasher,
                token_hasher=token_hasher,
                jwt_issuer=jwt_issuer,
            )
            application.state.vendor_user_commands = VendorUserCommandService(
                uow_factory=auth_uow_factory,
                clock=clock,
                id_generator=id_generator,
                password_hasher=password_hasher,
            )
            application.state.auth_user_queries = AuthUserQueryService(
                read_gateway=auth_read_gateway,
                clock=clock,
            )
            application.state.auth_token_verifier = AuthTokenVerifierService(
                jwt_issuer=jwt_issuer,
                read_gateway=auth_read_gateway,
                clock=clock,
            )
            yield
        finally:
            await registry.aclose_all()

    application = FastAPI(
        title=resolved_settings.app_name,
        version="0.1.0",
        docs_url="/docs" if resolved_settings.docs_enabled else None,
        redoc_url="/redoc" if resolved_settings.docs_enabled else None,
        openapi_url="/openapi.json" if resolved_settings.docs_enabled else None,
        lifespan=lifespan,
    )
    application.state.settings = resolved_settings
    application.state.service_name = resolved_settings.service_name
    application.state.resources = ResourceRegistry()

    application.add_middleware(
        CORSMiddleware,
        allow_origins=resolved_settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=[REQUEST_ID_HEADER],
    )
    application.add_middleware(AccessLogMiddleware, logger=logger)
    application.add_middleware(RequestIdMiddleware, request_id_context=request_id_context)

    register_exception_handlers(
        application,
        logger=logger,
        request_id_context=request_id_context,
    )

    application.include_router(health_router)
    application.include_router(corporations_router)
    application.include_router(corporate_relations_router)
    application.include_router(auth_router)
    application.include_router(vendor_auth_router)
    return application


app = create_app()
