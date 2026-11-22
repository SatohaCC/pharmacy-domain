# Frontend App Router・URL 状態同期ルール

`frontend/src/app/` および `frontend/src/features/` でルーティング・レイアウト・URL 状態を扱うときは、以下の契約を守る。

## 1. 共通レイアウト契約のルート横断保証

- `app/**/layout.tsx` で配下ページに前提を課す要素（スキップリンクの対象 ID、ランドマーク、必須コンテキスト等）を追加・変更する場合は、**同一 PR 内で**配下の全 `page.tsx` を一覧確認し、契約を満たす状態にする。
- 契約充足を別サブ Issue や後続 PR に先送りしない（PR 単体で全ルートが正しく機能する状態を維持する）。
- 各 `page.tsx` に暗黙の実装を要求するより、`layout.tsx` 側で構造ごと完結できる場合はそちらを優先する。

## 2. URL クエリ・Server Props との状態同期

- `searchParams` や Server Component 由来の `initial*` Props を Client Component で扱う場合、`useState(initial*)` の初回コピーと `popstate` リスナーだけで完結させない。
- URL を真実のソースとし、以下の **4 経路すべて** で表示状態と URL が一致する実装・テスト（ユニットまたは E2E）を揃える。
  1. 初回 SSR / ハードリロード
  2. 画面内操作による URL 更新
  3. ブラウザの戻る・進む（`popstate`）
  4. **同一ルートへのクライアント遷移（`<Link>` / `router.push`）** — `useSearchParams()` への追従、または親での `key` 切り替えで再同期する
- 同一ルート遷移でフォーム入力中テキスト等を誤って破棄しないよう、自前の URL 更新と外部遷移を区別する。

## 3. Next.js 同梱ドキュメントの確認トリガー

- `next/navigation`、`window.history`（`pushState` / `replaceState`）、`searchParams`、`Suspense`、キャッシュ設定を扱う変更前は、`frontend/node_modules/next/dist/docs/` の該当ガイドを確認する。
- 例: Next.js App Router で `window.history.replaceState` を呼ぶ際は、第 1 引数に `window.history.state` を流用せず `null` を渡す（内部状態フラグにより `useSearchParams()` 更新がスキップされるのを防ぐため）。
