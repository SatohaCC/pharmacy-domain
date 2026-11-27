---
name: github-issue-workflow
description: GitHub Issue を URL・番号から参照・要約するとき、下書き・起票・分割を依頼されたとき、dev-workflow で開発対象の Issue を確認・用意するときに使う。
---

# GitHub Issue の参照と起票

## 既存 Issue を参照する

URL または番号から対象リポジトリと Issue を特定する。本文・ステータスを読み、依頼に応じて関連する親子 Issue、コメント、PR を確認する。URL や番号だけの場合は、概要と現在の状態を伝える。参照・要約・進捗確認は読み取りの範囲で対応する。

実装・修正を依頼された場合は、[dev-workflow](../dev-workflow/SKILL.md) に従い、Issue と参照先から目的・受入条件・検証方法・未決事項を確認して着手する。

## サブ Issue に切り出す基準

開発着手前に、依頼全体の目的と受入条件を整理し、各条件を満たすための成果を並べる。候補ごとに次の点を確認する。既存の Issue やサブ Issue を再利用する場合も同じ基準で粒度を確認する。

1. **一つの成果を説明できる。** 利用者の操作やシナリオ、性能指標、独立して確認できる技術的な成果で切る。ある成果を後回しにしても他の成果を受け入れられるなら、別々のサブ Issue にする。
2. **完了を判定できる。** 対象範囲と、観測できる期待結果および検証方法を記す。一つの挙動の実現に UI・API・テスト・文書更新が必要なら、同じ作業単位に含める。
3. **小さな PR としてレビューできる。** 先行作業が完了した状態を前提に、その作業単位の差分と検証結果だけでレビュー・マージできるかを確かめる。先行作業がある場合は Issue と着手条件を明記する。API 契約の確定や調査を切り出す場合は、契約の検証や調査結果の記録など、PR で確認する成果物を先に決める。

例えば、タスク画面のレビューで「検索条件の URL 復元」「連続入力時のリクエスト抑制」「一覧より先に画面の枠を表示」「未保存の編集を閉じる前に確認」が挙がった場合、それぞれ完了を判定できるため分ける。URL の変換ヘルパーとそのテストは、URL 復元の作業に含める。

成果が一つなら既存または新規の Issue 一件で追う。複数なら親 Issue に全体の目的と受入条件を置き、各サブ Issue に担当する条件、成果物、検証方法、依存関係を記す。開発では、各サブ Issue を個別の PR で提出する手順を [dev-workflow](../dev-workflow/SKILL.md) に従って進める。起票や分割だけの依頼では、依頼された範囲でこの基準を使う。

## 起票内容

- 対象リポジトリと、指定された Issue がある場合はその親子関係を確認し、関連する既存 Issue と重複しないか調べる。同じ成果物の Issue があれば再利用を検討する。すでに別の親に属する場合、付け替えは明示されたときに行う。
- 依頼の目的に合うテンプレートを使う。
  - [バグ報告](../../../.github/ISSUE_TEMPLATE/bug_report.yml) は、再現手順、期待する動作、実際の動作を記録する。
  - [機能追加・改善要望](../../../.github/ISSUE_TEMPLATE/feature_request.yml) は、依頼全体の課題、実現したいこと、対象範囲、受入条件、根拠、未決事項を記録する。
  - [作業タスク](../../../.github/ISSUE_TEMPLATE/work_item.yml) は、個別にレビューする作業の範囲、成果物、完了条件と検証方法、必要な依存関係を記録する。サブ Issue に分ける場合は、対応する親 Issue や合意済みの要求を参照する。
- 下書きや分割案の依頼なら、タイトルと本文を提示し、分割する場合は親子関係の案も示す。GitHub への書き込みは、開発作業の Issue の起票・更新と必要な紐付け、または直接依頼された範囲に限る。

## GitHub での登録と確認

1. 対象の Issue があれば再利用し、新規なら起票する。既存のサブ Issue が対象なら、その親子関係を確認する。CLI では `gh issue create --repo <owner/repo> --title <title> --body-file <file>` を使える。該当テンプレートに既定ラベルがあれば適用する。作成・再利用した Issue の URL を控える。
2. 作業を分割する場合は、必要なサブ Issue を作成または再利用し、GitHub の Sub-issues 機能で親に紐付ける。CLI を使う場合は子の REST API の数値 `id` を取得し、親の Issue 番号を使って登録する。

   ```text
   gh api repos/<owner>/<repo>/issues/<child-number> --jq .id
   gh api --method POST repos/<owner>/<repo>/issues/<parent-number>/sub_issues -F sub_issue_id=<child-id>
   gh api --paginate repos/<owner>/<repo>/issues/<parent-number>/sub_issues --jq '.[].html_url'
   ```

3. 分割した場合は親の Sub-issues 一覧で各子の URL を確認する。作成や紐付けが途中で失敗した場合は、作成済み Issue と紐付けの状態を確認してから未完了の操作だけを再試行する。対象 Issue の URL を報告し、サブ Issue や未完了の操作があればそれらも示す。

[GitHub の Sub-issues REST API](https://docs.github.com/en/rest/issues/sub-issues)
