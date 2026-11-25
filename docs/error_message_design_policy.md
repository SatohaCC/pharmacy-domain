# エラーメッセージ設計方針書（DDD × Secure by Design × 5要素UXモデル）

本資料は、`PharmacyDomain` におけるエラー表現について、**「DDDのレイヤー分離（純粋性・オニオン層境界）」「Secure by Design（PII・内部情報漏洩防止）」「利用者にとって分かりやすく行動につながるUX」** の3つを同時に満たすための設計方針を定めたものである。

---

## 1. 基本方針：エラーメッセージの5要素モデル

ユーザーへ提示するすべてのエラーは、以下の**5つの要素**（＋アクションボタン）で構成される。  
各要素はトースト・インラインアラート・ダイアログ・カードなど UI の表示形式を問わず破綻しないよう、**接続詞でつなぐ断片（「〜ですが、」）ではなく、それぞれ独立した完結文**として定義する。

| 要素 | 英語定義 | 役割・伝えるべき内容 |
| :--- | :--- | :--- |
| **1. 何が起きたか** | *Say what happened* | 失敗した操作を簡潔に言い切る見出し（例：「薬歴を確定できませんでした」）。 |
| **2. 安心材料** | *Provide reassurance* | **サーバーが保証できる事実のみ**を伝える（例：「既存のデータは変更されていません。」「入力中の下書きデータは保持されています。」）。下書き保持やロールバックが保証できない場合（500系等）に虚偽の安心材料を提示しない。 |
| **3. なぜ起きたか** | *Say why it happened* | 失敗の業務的・システム的原因（例：「残薬確認の結果が未入力のため、確定できませんでした。」）。 |
| **4. どう直すか** | *Help them fix it* | 次に取るべき具体的な修正アクション（例：「残薬がない場合でも「残薬なし」と入力して、再度お試しください。」）。 |
| **5. 逃げ道・連絡先** | *Give them a way out* | 解決しない場合のエスカレーション先や代替手段（例：「問題が続く場合は、管理薬剤師またはサポート窓口へお問い合わせください。」）＋エラー種別に応じた適切なボタン（`fix_input` / `reload` / `go_back` / `retry` / `cancel` / `contact_support` 等）。 |

---

## 2. レイヤー間の責務分担（DDD・オニオンアーキテクチャ準拠）

5要素すべてをドメイン例外（`DomainError`）に書くと、ドメイン層が「下書き保存されたか」「画面にどのボタンを出すか」「サポート窓口が何か」というUI・トランザクションの都合に汚染される。また、オニオンアーキテクチャの依存方向制約（`presentation` → `application` → `domain`）により、**プレゼンテーション層はドメイン層を直接参照してはならない**。そのため、責務を以下のように分離する。

| 層 | 責務 | 扱う情報 |
| :--- | :--- | :--- |
| **ドメイン層**<br>(`app/domain/foundation/exceptions.py`) | **何が・なぜルール違反か**を最小構造で伝える。 | `message`（業務ルール違反の事実）、`code`（機械可読コード）、`details`（対象フィールド名等のスカラー値）、IDOR秘匿要否（`DomainAuthorizationError.conceal_as_not_found`）。各サブクラスは `default_code` のみ宣言する。 |
| **アプリケーション層**<br>(`app/application/foundation/errors.py`, `error_mappers.py`) | 公開例外契約（`ApplicationError` 階層）を定義し、`error_mappers.py` でドメイン例外を変換してトランザクション・保存状態の文脈を付与する（`errors.py` 自体は `app.domain` へ依存させず、`presentation` からの推移的依存を防ぐ）。 | `ApplicationError` 階層、`state_impact`（`"unchanged"` / `"draft_preserved"` / `"unknown"`）、`conceal_as_not_found`。 |
| **プレゼンテーション層**<br>(`app/presentation/error_presenter.py`, `error_handlers.py`, `dto/error.py`) | アプリ例外＋リクエスト検証（422）・HTTP例外・予期しない例外（500）を統一 **5要素 `ErrorResponse`** へ組み立て、HTTP 出力境界で一元的にサニタイズする。 | `title`（見出し）、`reassurance`（安心材料）、`how_to_fix`（対処案内カタログ）、`way_out`（連絡先）、エラー種別に応じた `actions`（ボタン）、`detail` / `errors`（後方互換）、および出力サニタイズ。 |

### 例外クラスの使い分け

| ドメイン例外クラス | アプリケーション例外クラス | 発生させる場面 | 主な用途（薬局ドメイン例） |
| :--- | :--- | :--- | :--- |
| **`DomainValidationError`** | **`ApplicationValidationError`** (422) / **`ApplicationBadRequestError`** (400) | 値・フォーマット・集約の不変条件違反／更新指定不正 | 記号/番号の形式不正、残薬欄未入力、加算根拠不足、空PATCH |
| **`DomainAuthorizationError`** | **`ApplicationAuthorizationError`** (403 / IDOR秘匿時は 404) | 資格・ロール・テナント境界違反 | 事務員による薬歴承認・取りそろえ前確認の試行、他店舗アクセス |
| **`DomainConflictError`** | **`ApplicationConflictError`** (409) | 状態競合・一意性・ライフサイクル制約 | 確定済み調剤録の直接更新、法人番号重複、管理薬剤師の兼務割当 |
| **`DomainNotFoundError`** | **`ApplicationNotFoundError`** (404) | 指定IDの対象エンティティが存在しない | 指定された患者ID・処方箋ID・法人IDが見つからない |

### 422 / 500 / HTTP 例外の統一とアクション設計

- **HTTP / OpenAPI 契約 (`ErrorResponse`)**: 5要素フィールド（`title`, `reassurance`, `reason`, `how_to_fix`, `way_out`, `actions`, `details`）に加えて既存の `code`, `detail`, `errors` を保持し、フロントエンドの `ApiError` はこれらを `userFacing` として読み取る。
- **リクエスト検証エラー（422 `RequestValidationError`）**: Pydantic の生 `msg` に生入力値が含まれるリスクを遮断するため、エラー種別（`type`）ごとの安全な日本語定型文へ正規化し、5要素 `ErrorResponse` として返却する。
- **システム例外（500）**: サーバーが操作結果や下書き保持を保証できないため、`state_impact="unknown"` 相当の誠実な安心材料（「処理結果が確定できていない可能性があります。最新の状態をご確認ください。」）を返す。
- **エラー種別ごとの推奨 `actions`**: 全エラー一律で「キャンセル / 再試行」にせず、入力不備（400/422）は `fix_input` + `cancel`、NotFound（404）は `go_back` + `contact_support`、競合（409）は `reload` + `cancel`、認可（403）は `go_back` + `contact_support`、500系は `retry` + `contact_support` とする。

---

## 3. Secure by Design に基づくセキュリティ・PII保護ルール

医療・薬局システムでは、エラーメッセージそのものが**要配慮個人情報（PII）やシステム内部情報の漏洩経路**にならないよう、以下のルールを厳守する。

1. **例外メッセージに PII・生入力値・生の識別子を絶対に埋め込まない**
   * **NG例**: `f"患者 {patient_name} の保険証番号 '{raw_number}' は不正です"`、`f"法人が見つかりません: {corporation_id}"`
   * **OK例**: `message="被保険者番号に空白やハイフンは使用できません。"`, `details={"field": "insurance_number"}`
   * プリミティブ層で `MaskedPiiText` 等の `__str__` をマスク（`"***"`）化しておき、万が一フォーマット文字列に渡されても平文が漏れないようにする。
2. **例外クラスは薄く保ち、出力サニタイズは HTTP 境界（`error_presenter.py`）に一元化する**
   * 例外生成の瞬間はすでに異常系に入っているため、Domain / Application 例外クラスでは `ValueError` / `TypeError` を送出せず素直に属性を保持する（本番での 500 化と重複コードの排除）。
   * 外部境界である `error_presenter.py` で一元的に以下を実施する：
     * 空・制御文字のみの `message` は既定文言へフォールバックし、制御文字（`\x00-\x1f`, `\x7f`）を除去する。
     * `code` は Allowlist（`^[A-Z][A-Z0-9_]*$`）で検証し、不一致時は `default_code` へフォールバックする。
     * `details` はキー Allowlist（`^[a-z][a-z0-9_]*$`）・安全なスカラー型・有限数値（`math.isfinite`）のみを残し、文字列値の制御文字を除去する。
3. **システム例外（500系）の完全サニタイズ**
   * DB接続エラー、SQL構文、ファイルパス、スタックトレースなどの予期しない例外はサーバー内部のセキュアログ（`X-Request-ID` 相関付き）にのみ記録し、ユーザー向けレスポンスでは固定の安全な文言へ変換する。5xx 系の `HTTPException` でも生 `detail` をそのまま露出しない。
4. **IDOR対策（存在有無の推測防止）**
   * 他テナント・他店舗や閲覧権限のない M&A 境界越えの `DomainAuthorizationError(..., conceal_as_not_found=True)` / `ApplicationAuthorizationError(..., conceal_as_not_found=True)` は、プレゼンテーション層で `404 Not Found`（固定文言・`code="NOT_FOUND"`・`details=None`）へ統一マッピングし、リソースの存在有無を推測させない。

---

## 4. 薬局ドメインにおける5要素エラーカタログ例

| `code` | 1. 見出し (`title`) | 2. 安心材料 (`reassurance`) | 3. 原因 (`reason`) | 4. 対処法 (`how_to_fix`) | 5. 逃げ道 (`way_out`) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `CORPORATION_NOT_FOUND` | 法人情報が見つかりませんでした | 既存のデータは変更されていません。 | 指定された法人が見つかりません。 | 対象が削除または変更されていないか一覧画面で確認のうえ、再度選択してください。 | 問題が解決しない場合は、管理薬剤師またはサポート窓口へお問い合わせください。 |
| `DUPLICATE_CORPORATE_NUMBER` | 法人情報を登録・更新できませんでした | 既存のデータは変更されていません。 | 同じ法人番号の法人が既に存在します。 | 法人番号に誤りがないか確認し、既存の法人情報と重複していないかご確認ください。 | 問題が解決しない場合は、管理薬剤師またはサポート窓口へお問い合わせください。 |
| `INTERNAL_SERVER_ERROR` | 処理を完了できませんでした | 処理結果が確定できていない可能性があります。最新の状態をご確認ください。 | サーバー内部の一時的な問題により処理を完了できませんでした。 | しばらく時間をおいてから、最新の状態を確認のうえ再度お試しください。 | 問題が繰り返し発生する場合は、サポート窓口へお問い合わせください。 |

---

## 5. Python 実装リファレンス

### 5-1. ドメイン層（`app/domain/foundation/exceptions.py`）

```python
"""ドメイン層の基底例外定義。"""

from collections.abc import Mapping
from types import MappingProxyType
from typing import ClassVar

type ErrorDetailScalar = str | int | float | bool | None
type ErrorDetails = Mapping[str, ErrorDetailScalar]


class DomainError(Exception):
    """ドメインルール違反の基底例外（PIIや秘密値は含めない）。"""

    default_code: ClassVar[str] = "DOMAIN_ERROR"

    def __init__(
        self,
        message: str,
        *,
        code: str | None = None,
        details: ErrorDetails | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.code = code or self.default_code
        self.details: ErrorDetails = (
            MappingProxyType(dict(details)) if details else MappingProxyType({})
        )


class DomainValidationError(DomainError):
    default_code: ClassVar[str] = "VALIDATION_ERROR"


class DomainAuthorizationError(DomainError):
    default_code: ClassVar[str] = "FORBIDDEN"

    def __init__(
        self,
        message: str,
        *,
        code: str | None = None,
        details: ErrorDetails | None = None,
        conceal_as_not_found: bool = False,
    ) -> None:
        super().__init__(message, code=code, details=details)
        self.conceal_as_not_found = conceal_as_not_found
```

### 5-2. アプリケーション層（`app/application/foundation/errors.py`, `error_mappers.py`）

`app/application/foundation/errors.py` は `app.domain` へ依存しない純粋な公開例外契約のみを持ち、ドメイン例外からの変換は `app/application/foundation/error_mappers.py` に分離する（`import-linter` による `presentation` → `domain` の推移的依存禁止および公開契約のみの参照制限を満たすため）。

```python
"""ドメイン例外からアプリケーション層公開例外への変換ヘルパー。"""

def from_domain_error(
    exc: DomainError,
    *,
    state_impact: StateImpact = "unchanged",
) -> ApplicationError:
    """ドメイン例外をアプリケーション層の公開例外へ変換する。"""
    if isinstance(exc, DomainAuthorizationError):
        return ApplicationAuthorizationError(
            exc.message,
            code=exc.code,
            details=exc.details,
            state_impact=state_impact,
            conceal_as_not_found=exc.conceal_as_not_found,
        )
    ...
```

### 5-3. プレゼンテーション層（`app/presentation/error_presenter.py`）

プレゼンテーション層は `ApplicationError` のみを参照し（`DomainError` を直接 import しない）、IDOR 秘匿（`conceal_as_not_found` → `404 NOT_FOUND`）・`state_impact` に基づく安全な `reassurance`・コード別カタログ・カテゴリ別 `actions`・境界サニタイズを組み合わせて `ErrorResponse` を返す。
