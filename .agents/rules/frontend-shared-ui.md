# Frontend `shared/ui` & `shared/components` 設計・移植ルール

`frontend/src/shared/` 配下の UI 部品は、他のプロジェクトへディレクトリごとそのまま移植できる状態を維持する。

## 1. レイヤーと依存方向

- `shared/ui`: アトミックな最小部品。`@ui-sdk/react` などのヘッドレス UI ライブラリの import はここに閉じ込める。
- `shared/components`: `shared/ui` を組み合わせた複合 Presentational 部品。`shared/ui` と `shared/styles` のみに依存する。
- `shared/lib`: 非 UI 系の外部ライブラリ（`@tanstack/react-query` など）のアダプタ・ラッパーを閉じ込める層。`features/*` や `app/*` から外部ライブラリを直接 import しない（スキーマ定義に使う `zod` は例外として直接 import を許可する）。
- `features/*` / `app/*`: データ取得・状態管理・ルーティングを担う。基本部品は `shared/ui`、複合部品は `shared/components`、非 UI 系ライブラリは `shared/lib` のアダプタを使う（`zod` のみ直接 import 可。API 応答の共通エラー変換には `shared/lib/api/zodResponse` を利用する）。`@ui-sdk/*` は直接 import しない。

## 2. 移植性（禁止事項）

`shared/ui` および `shared/components` 内では以下を禁止する。

- すべてのデータ・表示状態・操作ハンドラは **Props** で受け取る（`fetch`、API クライアント、グローバルストアの参照禁止）。
- アプリ固有のドメイン型・ドメイン文言のハードコード禁止（文言やラベルも Props で受け取る）。
- Next.js 固有 API（`next/navigation` 等）への直接依存禁止（遷移等が必要な場合はコールバックや `render` Prop で外から注入する）。

## 3. ファイル構成と StyleX 分離

1 部品につき 1 ディレクトリを作成し、以下を揃える。

```text
<component-name>/
├── <ComponentName>.tsx          # 描画と Props 受け渡しのみ
├── <ComponentName>.styles.ts    # stylex.create の定義専用
├── <ComponentName>.stories.tsx  # Storybook（主要バリアント・状態）
└── <ComponentName>.test.tsx     # Vitest + Testing Library
```

- `stylex.create(...)` は必ず `*.styles.ts` に分離し、コンポーネントファイル内に直書きしない。
- 色・角丸などのデザイン値は `shared/styles/tokens.stylex.ts` のセマンティックトークンを参照し、生のカラーコードを直書きしない。
- `*.stylex.ts` の import は StyleX コンパイラ（Babel）で確実に解決できるよう **相対パス**（例: `../../styles/tokens.stylex`）を使う。

## 4. 検証

部品の追加・変更後は以下を実行して通過を確認する。

- `pnpm check`（Biome + TypeScript + Ruff）
- `pnpm test`（Vitest + pytest）
- `pnpm build`（Next.js ビルド）
