class AppError(Exception):
    """サービス層から送出するアプリケーション共通例外。"""

    def __init__(self, message: str, *, code: str = "APP_ERROR", status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
