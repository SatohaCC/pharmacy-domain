# Backend 設計ルール

`backend/app/` は DDD・オニオンアーキテクチャ構成（`domain` / `application` / `infrastructure` / `presentation` + Composition Root `main.py`）を採用し、業務ルールと整合性境界を内層に閉じ込める。詳細は `.agents/skills/ddd-onion-bestpractices/` を参照する。

## 1. ディレクトリと責務

- `app/main.py`: Composition Root。FastAPI アプリの生成・ミドルウェア・`lifespan`（共有資源の登録・解放とユースケース配線）・ルーター登録のみを行う。
- `app/domain/`: Domain Primitive・Value Object・Entity / Aggregate Root・Domain 例外・Repository 抽象（Protocol）。標準ライブラリと `app.domain` 内の許可されたモジュールのみに依存する。
- `app/application/`: 共通基盤（`foundation/errors.py`・`foundation/error_mappers.py`・`foundation/ports.py`）とコンテキスト別のユースケース（`commands.py` / `queries.py`）・公開入出力契約および Inbound Port（`contracts.py`）・Outbound Port（`ports.py`）・内部変換（`mappers.py`）。`app.domain` と標準ライブラリのみに依存し、Pydantic・FastAPI・SQLAlchemy に依存しない。
- `app/infrastructure/`: Repository / QueryPort / UnitOfWork の具体実装、設定（`config.py`）、構造化ログ（`logging.py`）、共有資源管理（`resources.py`）、DB 接続と Alembic 用メタデータ。
- `app/presentation/`: HTTP / WebSocket ルーター（`routes/`）、Pydantic DTO（`dto/`）、明示的変換（`mappers/`）、DI プロバイダー（`dependencies.py`）、例外変換（`error_handlers.py` / `error_presenter.py`）、ミドルウェア（`middleware.py`）。`app.domain` と `app.infrastructure` を直接 import せず、`app.application` からは公開契約（`app.application.foundation.errors` と `app.application.*.contracts`）のみを import する。

## 2. 依存方向と資源寿命

- `presentation` → `application` の公開契約（`foundation.errors` / `*.contracts`）のみ（`domain` / `infrastructure` / `main` / `application` 内部実装は禁止）
- `application` → `domain`（`infrastructure` / `presentation` / `main` / Web・DB フレームワークは禁止）
- `domain` → `domain` 内のみ（外層・フレームワークは禁止）
- `infrastructure` → `application` / `domain`（`presentation` / `main` / `fastapi` は禁止）
- Engine 等の共有資源は起動時に `app.state.resources`（`ResourceRegistry`）へ登録し、終了時の `lifespan` で `aclose_all()` により逆順で解放する。
- DB 接続・トランザクション（`UnitOfWork`）は操作単位で生成し、並行操作間で共有しない。

## 3. 検証

変更後は以下を実行して通過を確認する。

- `pnpm check`（Ruff lint / format check + import-linter + mypy + OpenAPI 型整合）
- `pnpm test`（pytest）
