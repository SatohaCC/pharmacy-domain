"""FastAPI のリクエスト単位 DI プロバイダー。"""

from typing import cast

from fastapi import Request

from app.application.corporate.contracts import (
    CorporateRelationCommandPort,
    CorporateRelationQueryPort,
    CorporationCommandPort,
    CorporationQueryPort,
)


def get_service_name(request: Request) -> str:
    """起動時に設定されたサービス名を取得する。"""
    return str(request.app.state.service_name)


def get_corporation_commands(request: Request) -> CorporationCommandPort:
    """Composition Root が配線した法人更新系（Command）ポートを取得する。"""
    commands = getattr(request.app.state, "corporation_commands", None)
    if commands is None:
        raise RuntimeError("CorporationCommandService が初期化されていません。")
    return cast(CorporationCommandPort, commands)


def get_corporation_queries(request: Request) -> CorporationQueryPort:
    """Composition Root が配線した法人参照系（Query）ポートを取得する。"""
    queries = getattr(request.app.state, "corporation_queries", None)
    if queries is None:
        raise RuntimeError("CorporationQueryService が初期化されていません。")
    return cast(CorporationQueryPort, queries)


def get_corporate_relation_commands(request: Request) -> CorporateRelationCommandPort:
    """配線済みの法人間関係の更新ポートを取得する。"""
    commands = getattr(request.app.state, "corporate_relation_commands", None)
    if commands is None:
        raise RuntimeError("CorporateRelationCommandService が初期化されていません。")
    return cast(CorporateRelationCommandPort, commands)


def get_corporate_relation_queries(request: Request) -> CorporateRelationQueryPort:
    """配線済みの法人間関係の参照ポートを取得する。"""
    queries = getattr(request.app.state, "corporate_relation_queries", None)
    if queries is None:
        raise RuntimeError("CorporateRelationQueryService が初期化されていません。")
    return cast(CorporateRelationQueryPort, queries)
