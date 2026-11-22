# Next.js + FastAPI Template

Next.js + FastAPI + pnpm 12 + Vercel のプロジェクトテンプレートです。

## 必要な環境

- Node.js 26.x
- pnpm 12.18.0（ルートの `package.json` の `packageManager` / `engines` に指定）
- Python 3.14（`backend/.python-version` に指定。pnpm の Python ワークスペース機能で環境を管理）

Corepack を利用する場合は、初回に次を実行します。Node.js 25 以降では Corepack が標準同梱されないため、未導入の場合は `npm install -g corepack` で先に導入するか、pnpm 12.18.0 本体を直接インストールしてください。

```powershell
corepack enable
corepack prepare pnpm@12.18.0 --activate
pnpm --version
```

## セットアップと起動

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

`pnpm-workspace.yaml` の `python.enabled: true` により、Frontend・Backend の依存関係をまとめてインストールします。通常の開発起動には環境変数の設定は不要です。

- Frontend: http://localhost:3000
- タスク管理 CRUD サンプル: http://localhost:3000/tasks
- Backend: http://127.0.0.1:8000/api/health
- FastAPI APIドキュメント: http://127.0.0.1:8000/docs

開発時は Next.js が `/api/*` を Backend に転送します。転送先を変更する場合は、ルートの `.env.example` を `frontend/.env.local` にコピーし、`BACKEND_URL` を編集して Frontend を再起動してください。Next.js は `frontend/` をアプリのルートとして環境変数を読み込みます。

Backend は `pydantic-settings` でプロセス環境変数を検証します。`.env.example` を参考に、許可する Origin をカンマ区切りで指定する `CORS_ORIGINS`（既定値 `http://localhost:3000` と `http://127.0.0.1:3000`）、API ドキュメント公開を切り替える `DOCS_ENABLED`（既定値 `true`）、ログレベルの `LOG_LEVEL`（既定値 `INFO`）、SQLite ファイルの `DATABASE_PATH`（既定値 `data/app.db`）を設定できます。テストでは `create_app(Settings(...))` で設定を明示的に渡せます。

### タスク DB のマイグレーション

タスクの保存は SQLAlchemy Core、テーブル定義の更新は Alembic が担当します。SQLite ファイルは `DATABASE_PATH` で指定し、既定では `backend/data/app.db` を使います。通常起動時に Alembic が最新のリビジョンを適用します。

DB を先に準備したい場合は、依存関係をインストールした後に次を実行します。

```powershell
pnpm -C backend exec python -B -m alembic upgrade head
```

従来の SQLite ファイルを引き継ぐ場合は、サーバーを停止して DB をバックアップし、`DATABASE_PATH` に既存ファイルを指定して同じコマンドを実行します。初期リビジョンは既存の `tasks` テーブルの列構成を確認し、内容を保持したまま管理対象にします。適用後は `pnpm -C backend exec python -B -m alembic current` でリビジョンを確認できます。

## 構成

- `frontend/src/app/`: App Router、レイアウト、ページ
- `frontend/src/features/`: データ取得と表示の接続（Container / custom Hook）
- `frontend/src/shared/ui/`: ヘッドレスUIを包む、Props ベースの最小部品
- `frontend/src/shared/components/`: UI部品を組み合わせる Presentational コンポーネント
- `frontend/src/shared/lib/`: OpenAPI 型付き API クライアント（Client 用 `apiRequest` / RSC 用 `serverApiRequest`）、レスポンス検証、React Query ラッパー等の外部ライブラリアダプタ
- `frontend/config/stylexVitePlugin.mts`: Storybook / Vitest 共通の StyleX 変換
- `backend/app/`: FastAPI の `routers` / `schemas` / `services` / `clients` / `core`
- `.agents/rules/`: 設計・コーディング規約
- `.agents/skills/`: React の責務分離、Effect の要否判断の Skill
- `.github/workflows/ci.yml`: 静的検証、単体テスト、E2E、Storybook描画、本番ビルド
- `vercel.json`: Frontend / Backend の Services と公開ルーティング
- `scripts/`: Node.js 26 で直接実行する TypeScript（`.mts`）の開発用スクリプトとテスト。型チェックは `pnpm typecheck:scripts`

### API 応答の実行時検証

FastAPI の Pydantic モデルを更新したら `pnpm gen:api-types` で TypeScript 型を生成します。新しい API では `@/shared/lib/api/zodResponse` の `z` を使って機能ディレクトリに応答スキーマを定義し、パーサの戻り値に生成型を指定します。パーサは `apiRequest` または `serverApiRequest` の `parse` に渡します。`parseZodResponse` が検証失敗を `ApiError` の `INVALID_RESPONSE` に変換します。実装例は [`tasksApi.ts`](frontend/src/features/tasks/tasksApi.ts) を参照してください。

## コマンド

バージョン管理には Git を使用します。コミット手順は [git-commit Skill](.agents/skills/git-commit/SKILL.md) を参照してください。コミット前は Git フック（`pre-commit`）や `pnpm check`・必要なテストで検証します。

| コマンド | 内容 |
|---|---|
| `pnpm dev` | Frontend と Backend を同時起動 |
| `pnpm dev:frontend` / `pnpm dev:backend` | 各サーバーを単独起動 |
| `pnpm lint` | Biome、Ruff、Backend の依存方向チェック |
| `pnpm format` | Biome / Ruff による整形・修正 |
| `pnpm check` | 依存のインストール状況、ローカルパス、Biome、フロントエンドの依存方向・StyleX の配置、TypeScript、mypy、Ruff、Backend の依存方向・整形、OpenAPI 生成型を検査 |
| `pnpm check:deps` | ルートと `frontend` の JavaScript 直接依存に未インストールのものがないか検査 |
| `pnpm check:frontend-boundaries` | 相対パスとエイリアスの依存先、StyleX 定義のファイル配置と参照パスを検査 |
| `pnpm check:paths` | Git対象のファイルとリンクにローカルの絶対パスがないか検査 |
| `pnpm test` | 検査スクリプトのテスト、Frontend の Vitest、Backend の pytest |
| `pnpm test:frontend` / `pnpm test:backend` | 各単体テストを個別実行 |
| `pnpm test:e2e` | 開発サーバーを起動し、Chromium から FastAPI まで検証 |
| `pnpm build` | Next.js の本番ビルド |
| `pnpm storybook` | Storybook を http://localhost:6006 で起動 |
| `pnpm build-storybook` | Storybook の静的ビルド |
| `pnpm test:storybook` | 静的ビルド後、全ストーリーの描画と StyleX の適用を Chromium で検証 |
| `pnpm gen:api-types` | FastAPI の OpenAPI スキーマから Frontend 用 TypeScript 型を生成 |
| `pnpm check:api-types` | OpenAPI 生成型に差分（ドリフト）がないか検査 |

E2E / Storybook のブラウザ検証前に、初回のみ Chromium をインストールします。

```powershell
pnpm --filter frontend exec playwright install chromium
```

Linux でシステム依存も導入する場合は `playwright install chromium --with-deps` を使います。E2E はポート 3000 / 8000、Storybook 検証は 6007 を使用します。E2E はローカルで起動済みのサーバーを再利用し、CI では新規起動します。Storybook 検証は常に専用サーバーを起動するため、6007 を空けてください。開発用Storybookの6006とは別ポートです。

## Vercel

[Vercel Services](https://vercel.com/docs/services)（Beta）で Next.js と FastAPI を同じプロジェクトへ配置します。

- Vercel プロジェクトの Root Directory はリポジトリのルートを指定します。
- `frontend` サービスは `frontend/` の Next.js をビルドします。
- `backend` サービスは `backend/` の `app.main:app` を FastAPI のエントリポイントとして読み込みます。
- `/api/*` は Backend、それ以外は Frontend へ転送します。Backend に渡るパスは `/api/health` のままです。
- 本番のAPI接続は同一ドメインのルーティングを使うため、開発用の `BACKEND_URL` は不要です。
- Frontend のインストールは Corepack 経由で実行し、`package.json` に指定した pnpm のバージョンを使います。

Vercel Services を介さずローカルで本番ビルドを確認する場合は、ビルド前に `BACKEND_URL` を設定します。API の転送先はビルド時に確定します。

```powershell
$env:BACKEND_URL = "http://127.0.0.1:8000"
pnpm build
pnpm --filter frontend start
```

FastAPI は別のターミナルで `pnpm dev:backend` を実行してください。

Vercel の Git 連携では、この設定を持つリポジトリのルートからデプロイします。初回プレビューでは `/` の表示、`/api/health` のJSON応答、画面の更新操作を確認してください。`pnpm build` は Next.js のビルド検証であり、Vercel 上のサービス結合まで検証するものではありません。

## 生成物とキャッシュ

- `.cache/`: Ruff / mypy / Vitest のキャッシュ、Playwright の結果、Storybook の静的ビルド
- `backend/.venv`: pnpm が管理する Python 環境へのリンク。ローカル環境に依存するため Git から除外
- `*.tsbuildinfo`: TypeScript の増分ビルド情報。Git から除外
- `frontend/.next/`: Next.js の開発・ビルド出力
- Python の起動コマンドは `-B` で bytecode 生成を抑制。pytest のキャッシュは無効化

`pnpm-lock.yaml` と `backend/pylock.toml` は依存関係を再現するためコミットします。Dependabot 等で `backend/pyproject.toml` のみ更新された場合は、`pnpm install --no-frozen-lockfile` を実行して `backend/pylock.toml` を同期してください。

`pnpm check:paths` は追跡中・未追跡の無視されていないファイルを検査します。Windows のドライブ付きパス、Unix のホーム配下、file URI、UNCパス、絶対パスのリンクを検出すると失敗します。コミット直前のステージ内容だけを検査する場合は `pnpm check:paths --staged` を使います。検出したパスの値はログに出しません。除外済みの生成物やバイナリ、外部へ貼り付ける実行ログはこの検査の対象外です。

ローカルでの `pnpm install` 時に Git フックを設定します。`pre-commit` はステージ済みのローカルパスを、`commit-msg` はコミット件名の Conventional Commits 形式を検査します。Git が生成する標準のマージ・取り消し件名と、形式に合う fixup・squash・amend 件名も受け付けます。再設定は `pnpm hooks:install` で実行できます。既存の `pre-commit`・`commit-msg`・`pre-push` を引き継ぎ、以前のパスはローカル Git 設定だけに保存します。CI や Git 管理外ではインストール処理をスキップします。

`post-commit` など引き継ぎ対象外のフックがある場合は、既存設定を保つため自動設定をスキップします。ローカルパス検査は `pnpm check:paths --staged` で実行できます。

ブランチ切り替え後に `zod` などのモジュールが見つからない場合は `pnpm check:deps` で確認できます。不足があればリポジトリのルートで `pnpm install --frozen-lockfile` を実行します。

Python のロック対象は Windows x64 と Linux x64（manylinux 2.28 以降）、Python 3.14 です。別のOS・CPUを使う場合は `pnpm-workspace.yaml` の `supportedArchitectures` に追加し、`pnpm install --no-frozen-lockfile` でロックファイルを更新してください。

## テンプレートから新規プロジェクトを作成する

このテンプレートを複製して新しいアプリケーションを立ち上げる際は、以下の箇所を確認・更新してください。

- [ ] **パッケージ名・メタ情報**: ルートの `package.json`（`name`）、必要に応じて `frontend/package.json`、`backend/pyproject.toml`（`name` / `description`）を変更する
- [ ] **Backend 基本設定**: `backend/app/core/config.py` の `app_name`（OpenAPI タイトル）と `service_name`（`/api/health` の返却値）を変更する
- [ ] **メタデータ・アイコン・サンプル画面**: `frontend/src/app/layout.tsx` の `metadata`（`title` / `description`）と `frontend/src/app/icon.svg` を更新し、`frontend/src/app/page.tsx` のサンプル内容をアプリの画面へ差し替える
- [ ] **ヘルスチェックと E2E テスト**: `frontend/src/features/health/` と `frontend/e2e/health.spec.ts` を確認し、ヘルスチェックを残す場合は `service_name` の期待値（既定値 `template-backend`）や文言を新アプリに合わせて更新する
- [ ] **テーマ・配色トークン**: `frontend/src/shared/styles/tokens.stylex.ts` の `palette` / `tokens` をプロダクトの配色に合わせてカスタマイズする
- [ ] **環境変数とデプロイ設定**: `.env.example` を参照して `frontend/.env.local`（`BACKEND_URL`）や Backend のプロセス環境変数（`CORS_ORIGINS`・本番環境では必要に応じて `DOCS_ENABLED=false` や `LOG_LEVEL`）を設定し、必要に応じて `vercel.json` のルーティングやビルド設定を確認する

