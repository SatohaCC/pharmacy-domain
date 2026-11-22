# Backend 設計ルール

`backend/app/` はシンプルなレイヤード構成（`routers` / `schemas` / `services` / `clients` / `core`）を採用し、外部 SDK の隔離と単体テストのしやすさを維持する。

## 1. ディレクトリと責務

- `app/main.py`: FastAPI アプリの生成・ミドルウェア・`lifespan`・ルーター登録のみ。
- `app/core/`: 環境変数・設定（`config.py`）などの共通基盤。各モジュールで直接 `os.getenv` を散らさない。
- `app/routers/`: HTTP / WebSocket エンドポイント定義。入力検証と `services/` 呼び出しのみを行い、業務ロジックを書かない。
- `app/schemas/`: Pydantic の入出力モデル（API 契約）。
- `app/services/`: ビジネスロジック・ユースケース。FastAPI（`Request` / `HTTPException` 等）に依存しない。
- `app/clients/`: 音声・LLM・外部 API などの外部 SDK アダプタおよびライフサイクル管理（`ClientRegistry`）を閉じ込める層。`services/` から直接外部 SDK を import しない。

## 2. 依存方向と外部クライアントの DI

- `routers` → `services` / `schemas`
- `services` → `clients` / `schemas` / `core`
- `clients` → `core`（`routers` や `services` へ逆依存しない）
- 接続プールや外部 SDK クライアントは `create_app(..., client_startup=...)` 経由で起動時に `app.state.clients`（`ClientRegistry`）へ登録し、終了時の `lifespan` で `aclose_all()` により確実にクローズする。
- ルーターからは `app/routers/dependencies.py` の `get_client_registry` を `Depends(...)` で注入し、単体テスト時は `app.dependency_overrides[get_client_registry]` でモック用レジストリへ差し替える。

## 3. 検証

変更後は以下を実行して通過を確認する。

- `pnpm check`（Ruff lint / format check + mypy）
- `pnpm test`（pytest）
