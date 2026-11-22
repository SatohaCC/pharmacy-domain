# プロジェクトの作業ルール

このリポジトリで作業するときは、対象に応じて以下の規約を読む。

- コメント・docstring: [.agents/rules/coding-style.md](.agents/rules/coding-style.md)
- Backend: [.agents/rules/backend-architecture.md](.agents/rules/backend-architecture.md)
- Frontend の依存方向（`frontend/src/app/`・`frontend/src/features/` を含む）と共有 UI: [.agents/rules/frontend-shared-ui.md](.agents/rules/frontend-shared-ui.md)
- Frontend の App Router・レイアウト契約・URL 状態同期（`frontend/src/app/`・`frontend/src/features/`）: [.agents/rules/frontend-app-router.md](.agents/rules/frontend-app-router.md)

`frontend/` を変更する場合は、その配下の `AGENTS.md` も読む。プロジェクト固有のSkillは `.agents/skills/` にある。

## 開発作業

- このリポジトリへの変更を伴う開発作業は、着手時に [dev-workflow Skill](.agents/skills/dev-workflow/SKILL.md) を読み、入口として使う。
- 開発作業は Issue で追跡する。作業が1単位ならその Issue で実装・検証・PR を行う。個別に完了・レビューできる作業が複数ある場合は、作業単位でサブ Issue に分け、それぞれの PR を提出する。すでに対象のサブ Issue がある場合は再利用する。
- 開発依頼には、このリポジトリでの Issue の起票、分割時の親子の紐付け、作業単位ごとの PR 作成を含む。
- GitHub Issue を新規起票する直前に、[github-issue-workflow Skill](.agents/skills/github-issue-workflow/SKILL.md) と該当する `.github/ISSUE_TEMPLATE/*.yml` を開く。起票コマンドを実行する前に、本文の必須項目と適用する既定ラベルを確認する。起票後は GitHub 上の本文とラベルを確認する。直接の起票依頼と開発作業に伴う起票の両方に適用する。
- 複数の作業単位がある場合は、各単位が完了するたびに明示的な承認を得て push し、対応する PR を提出する。PR 作成後と PR ブランチへの追加 push 後に CI の結果を確認する。

## Git・コミット

- 作業前に `git status`・`git diff` で既存のユーザー変更を確認し、依頼された作業範囲と区別する。`git checkout --` / `git reset --hard` / `git clean` 等で既存変更を消去したりエラーを隠蔽したりしない。
- `git push` はユーザーから明示的に依頼・承認された場合のみ実行する。push 前に `pnpm check` と対象ブランチを確認し、`git push <remote> <branch>` のように対象を明示する。
- コミット実行前、またはコミットメッセージの作成・修正（案のみを含む）を行う前に、必ず [git-commit Skill](.agents/skills/git-commit/SKILL.md) を読み、適用する。メッセージは **Conventional Commits 1.0.0 形式で、説明を日本語** にする。
