# 共通認証・スコープ付きロール管理（ベンダー・薬局共通基盤）

## 基本方針とドメイン境界（案 B）

- **認証基盤の共通化**: ログイン主体（`User`）、パスワードポリシー・`scrypt`、JWT（アクセストークン 30 分 / リフレッシュトークン 480 分）、`RefreshSession`（ローテーション・再利用検知・即時失効）、CSRF 検証を単一の `auth` コンテキストとして管理する。
- **AWS ロール風のスコープ付きロール付与**: 権限は `RoleAssignment` として「`RoleName` ＋ `AuthScope(scope_type, tenant_id)` ＋ 半開区間有効期間 `[valid_from, valid_to)`」で付与する。
  - ベンダー用スコープ（`scope_type = "vendor"`, `tenant_id = None`）: `vendor_admin`, `vendor_member`
  - 薬局テナント用スコープ（`scope_type = "tenant"`, `tenant_id = <法人ID>`）: `tenant_admin`, `pharmacist`, `clerk`
- **1 ユーザー 1 所属の不変条件**:
  - `User` は作成時に単一の所属 `affiliation: AuthScope` に固定される。
  - ユーザーの所属 `affiliation` と異なるスコープへの `RoleAssignment` 付与はドメイン層および DB 制約で禁止する。
  - メールアドレスは、ベンダー所属ユーザーはシステム全体で一意、薬局テナント所属ユーザーは `(tenant_id, email)` の組み合わせで一意とする（同一人物が別法人で働く場合はそれぞれの法人に別 `User` を持つ）。
- **初期管理者のコンソール発行**: システムベンダーの最初の管理アカウント（`vendor_admin`）は、Web 上の公開サインアップを設けず、コンソール CLI（`python -B -m app.cli.bootstrap_vendor_admin`）のみから発行する。既にベンダー所属ユーザーが存在する場合、コンソールからの初期管理者再発行は拒否する。
- **Web での社員発行**: 初期管理者発行後のベンダー社員アカウント（`vendor_admin` / `vendor_member`）は、有効な `vendor_admin` ロールを持つユーザーのみが Web 管理画面（`/vendor/users`）および `POST /api/vendor/users` から発行する。
- **将来の保守作業代行**: ベンダー社員が薬局テナントの保守作業を行う場合は、恒久的な `RoleAssignment` を複数法人へ付与するのではなく、作業理由・対象法人・短期有効期限を伴う `AssumeRole` セッション（`RefreshSession` 拡張および監査ログ連携）で対応する方針とする。

## 管理する概念とモデル

| 概念 | 主な情報 | ルール・制約 |
| --- | --- | --- |
| 認証ユーザー (`User`) | ユーザーID、メールアドレス（小文字正規化）、表示名、所属スコープ（`affiliation: AuthScope`）、状態（`active` / `disabled`）、パスワードハッシュ、作成者ID | 所属スコープは作成時に固定（1ユーザー1所属）。`disabled` ユーザーは認証・トークン更新・API 実行を許可しない |
| ロール付与 (`RoleAssignment`) | 付与ID、ユーザーID、ロール名（`RoleName`）、スコープ（`AuthScope`）、有効期間 `[valid_from, valid_to)`、失効日時、付与者ID | `RoleName` の許容スコープと `AuthScope`、および対象 `User.affiliation` が一致する場合のみ付与可能 |
| リフレッシュセッション (`RefreshSession`) | セッションID（`jti`）、ファミリーID（`family_id`）、対象ユーザーID、アクティブスコープ（`scope: AuthScope`）、トークン SHA-256 ハッシュ、発行日時、有効期限、ローテーション日時、失効日時、置換先セッションID | 発行から **480 分** を有効期限とし、ローテーションおよび再利用検知によるファミリー単位失効を行う |

## 認証・セッション・パスワード要件

- **パスワード要件**: 医療情報システムの安全管理に関するガイドライン（第7.0版・二要素認証未導入時）に準拠し、**13 文字以上 128 文字以下**、制御文字・前後空白禁止、英大文字・英小文字・数字・記号のうち **3 種類以上** の混在を必須とする。Web 発行時は管理者が初期パスワードを設定し、安全なパスワードの自動生成ボタンを補助として提供する。
- **JWT トークン（HS256）**:
  - **アクセストークン**: 有効期限 **30 分（1800 秒）**、HttpOnly Cookie `auth_access_token`（`Path=/api`, `SameSite=Lax`, `Max-Age=1800`）で送信する。クレームに `scope_type`, `tenant_id`, `roles` を含み、検証時は DB 上の最新ユーザー状態・有効ロールを再確認する。
  - **リフレッシュトークン**: 有効期限 **480 分（28800 秒）**、HttpOnly Cookie `auth_refresh_token`（`Path=/api/auth`, `SameSite=Lax`, `Max-Age=28800`）で送信する。
- **ローテーションと再利用検知**: `POST /api/auth/refresh` 実行時は新しいセッションID・リフレッシュトークン・アクセストークンを発行して旧セッションを置換する。すでにローテーション済みまたは失効済みのリフレッシュトークンが再利用された場合は、同一 `family_id` の全セッションを即時失効させる。
- **ログアウト即時失効**: `POST /api/auth/logout` 実行時は DB 上の該当セッションファミリーを即時失効させ、ブラウザ側 Cookie を削除する。
- **CSRF 対策**: Cookie 認証を伴う状態変更 API では、許可された `Origin` / `Referer` 検証または `X-Requested-With: XMLHttpRequest` ヘッダを必須とする。

関連: [テナント・アクセス管理](tenant-access.md)、[相談・決定記録](../discussion-log.md)。
