---
name: github-pr-review-response
description: GitHub PR に付いたレビュー指摘の確認・対応・返信を依頼されたときや、担当 PR の提出・更新時に対応対象の指摘を確認したときに使う。個々の指摘への返信と投稿確認まで扱う。
---

# GitHub PR のレビュー指摘に対応する

1. **対象の指摘を取得する。** PR のリポジトリと番号を確かめる。指定された指摘の範囲で、差分に付いたインラインコメント、レビュー本文、会話欄のコメントを確認する。各指摘の URL と既存の返信を確認し、同じ対応結果が記載済みならその返信を使う。単なる承認や指摘を含まない自動サマリーは返信の対象から外す。閲覧・要約・返信案だけの依頼では、指定された成果を返す。
2. **指摘ごとに対応結果を確かめる。** 対象の差分と指摘の根拠を照合する。修正が必要なら、リポジトリの手順に従って修正・検証し、PR への push が反映されたことを確認する。既に修正済みなら、PR に含まれるコミットと既存の検証結果を確認する。対応を見送る場合は、判断の根拠を確認する。
3. **対応結果を投稿する。** 指摘ごとに、修正内容・PR に含まれるコミット SHA・実施した検証と結果、または対応を見送る理由を書く。未実施の検証はその旨を示す。インライン指摘は元のスレッドに返信する。レビュー本文や会話欄の指摘は、元コメントの URL と指摘ごとの回答を PR の会話欄に投稿する。
4. **GitHub 上で返信を確認する。** 投稿された返信の URL と元の指摘との対応を確認する。エラーやタイムアウト時は再取得し、投稿済みかを確かめてから不足分だけを再試行する。完了報告には返信先へのリンクを添え、返信できていない場合は元の指摘 URL と理由を示す。

## GitHub CLI を使う場合

取得コマンドはページをまたぐ場合も最後まで読む。インライン返信の POST には、返信先スレッドの起点となるコメントの数値 ID を使う（既存の返信には `in_reply_to_id` がある）。返信本文は UTF-8 のファイルに書いて渡す。

```text
gh api --paginate repos/<owner>/<repo>/pulls/<number>/comments
gh api --paginate repos/<owner>/<repo>/pulls/<number>/reviews
gh api --paginate repos/<owner>/<repo>/issues/<number>/comments
gh api --method POST repos/<owner>/<repo>/pulls/<number>/comments/<comment-id>/replies -F "body=@<file>" --jq .html_url
gh pr comment <number> --repo <owner>/<repo> --body-file <file>
```

[GitHub REST API のインライン返信](https://docs.github.com/en/rest/pulls/comments#create-a-reply-for-a-review-comment) · [`gh pr comment` のリファレンス](https://cli.github.com/manual/gh_pr_comment)
