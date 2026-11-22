# Frontend の作業ルール

画面や共有部品を変更するときは、[Frontend の依存方向と共有 UI の規約](../.agents/rules/frontend-shared-ui.md) を確認する。`src/app/`・`src/features/` でレイアウト・ルーティング・URL 状態同期を扱うときは、[Frontend App Router・URL 状態同期ルール](../.agents/rules/frontend-app-router.md) も確認する。表示とデータ取得・アプリケーション状態の境界を設計・変更するときは、[react-presentational-container](../.agents/skills/react-presentational-container/SKILL.md) を使う。

`ui-sdk` Skill のサンプルを使う場合も、この規約に沿って部品の置き場所と import 元を決める。画面では既存の `@/shared/ui` の部品を優先し、新しい基本部品が必要なら `src/shared/ui/` で追加・拡張する。

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
