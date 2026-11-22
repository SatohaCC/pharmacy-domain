from app.schemas.health import HealthResponse


def get_health_status(service_name: str) -> HealthResponse:
    """指定されたサービス名に対する現在のヘルスステータスを返す。"""
    return HealthResponse(status="ok", service=service_name)
