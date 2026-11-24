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
| **ドメイン層**<br>(`app/domain/foundation/exceptions.py`) | **何が・なぜルール違反か**を構造化して伝える。 | `code`（機械可読コード）、`reason`（業務ルール上の理由）、`action_hint`（修正の方向性）、安全な `details`（対象フィールド名等のスカラー値）、IDOR秘匿要否（`conceal_as_not_found`）。 |
| **アプリケーション層**<br>(`app/application/errors.py`) | ドメイン例外を公開例外へ変換し、トランザクション・保存状態の文脈を付与する。 | `ApplicationError` 階層、`state_impact`（`"unchanged"` / `"draft_preserved"` / `"unknown"`）、`conceal_as_not_found`。 |
| **プレゼンテーション層**<br>(`app/presentation/error_presenter.py`, `error_handlers.py`, `dto/error.py`) | アプリ例外＋リクエスト検証（422）・HTTP例外・予期しない例外（500）を統一 **5要素 `ErrorResponse`** へ組み立てる。 | `title`（見出し）、`reassurance`（安心材料）、`how_to_fix`（対処法）、`way_out`（連絡先）、エラー種別に応じた `actions`（ボタン）、`detail` / `errors`（後方互換）、およびサニタイズ。 |

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
   * **OK例**: `reason="被保険者番号に空白やハイフンは使用できません。"`, `details={"field": "insurance_number"}`
   * プリミティブ層で `MaskedPiiText` 等の `__str__` をマスク（`"***"`）化しておき、万が一フォーマット文字列に渡されても平文が漏れないようにする。
   * 例外クラス自身の防御エラー（不正な `code` や不正な `details` キーを検出した `ValueError`）にも、渡された生の値を文字列埋め込みしない。
2. **`details` の型とキーの厳格化**
   * `details` は平坦な構造とし、キーは Allowlist（`^[a-z][a-z0-9_]*$`）、値は安全なスカラー型（`str | int | float | bool | None`）に制限する。ネストしたオブジェクト・配列・制御文字（`\x00-\x1f`, `\x7f`）の混入を拒否し、不変マッピング（`MappingProxyType`）として保持する。
3. **システム例外（500系）の完全サニタイズ**
   * DB接続エラー、SQL構文、ファイルパス、スタックトレースなどの予期しない例外はサーバー内部のセキュアログ（`X-Request-ID` 相関付き）にのみ記録し、ユーザー向けレスポンスでは固定の安全な文言へ変換する。5xx 系の `HTTPException` でも生 `detail` をそのまま露出しない。
4. **IDOR対策（存在有無の推測防止）**
   * 他テナント・他店舗や閲覧権限のない M&A 境界越えの `DomainAuthorizationError` / `ApplicationAuthorizationError` に `conceal_as_not_found=True` を指定した場合、プレゼンテーション層で `404 Not Found`（固定文言・`code="NOT_FOUND"`・`details=None`）へ統一マッピングし、リソースの存在有無を推測させない。
5. **制御文字の排除**
   * ログ出力やレスポンスに含める識別子・`code` は Allowlist（`^[A-Z][A-Z0-9_]*$`）で検証し、ログ注入（Log Injection）を防ぐ。

---

## 4. 薬局ドメインにおける5要素エラーカタログ例

| `code` | 1. 見出し (`title`) | 2. 安心材料 (`reassurance`) | 3. 原因 (`reason`) | 4. 対処法 (`how_to_fix`) | 5. 逃げ道 (`way_out`) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `MISSING_RESIDUAL_STATUS` | 薬歴を確定できませんでした | 入力中の下書きデータは保持されています。 | 残薬確認の結果が未入力のため確定できませんでした。 | 残薬がない場合でも「残薬なし」と入力して、再度確定してください。 | 操作方法が不明な場合は、管理薬剤師へご確認ください。 |
| `PROXY_APPROVAL_REQUIRED` | レセプト請求へ進めません | 入力済みの調剤・薬歴記録は保存されています。 | 事務員が代行入力した薬歴が保険薬剤師により未承認のため、請求対象に含められません。 | 担当の保険薬剤師に内容確認と承認を依頼してください。 | 承認権限に関する問題は、システム管理者へご連絡ください。 |
| `FORBIDDEN_SEPARATOR_IN_INSURANCE_ID` | 保険資格を登録できませんでした | 既存のデータは変更されていません。 | 記号・番号に空白・中点・ハイフンが含まれているためレセ電仕様に適合しません。 | 記号と番号から空白や記号を取り除いて、再度入力してください。 | 資格確認書の記載が特殊な場合は、サポート窓口へお問い合わせください。 |
| `INTERNAL_SERVER_ERROR` | 処理を完了できませんでした | 処理結果が確定できていない可能性があります。最新の状態をご確認ください。 | サーバー内部の一時的な問題により処理を完了できませんでした。 | しばらく時間をおいてから、最新の状態を確認のうえ再度お試しください。 | 問題が繰り返し発生する場合は、サポート窓口へお問い合わせください。 |

---

## 5. Python 実装リファレンス

### 5-1. ドメイン層（`app/domain/foundation/exceptions.py`）

```python
"""ドメイン層の基底例外定義。"""

import re
from collections.abc import Mapping
from types import MappingProxyType

type ErrorDetailScalar = str | int | float | bool | None
type ErrorDetails = Mapping[str, ErrorDetailScalar]

_ERROR_CODE_PATTERN = re.compile(r"^[A-Z][A-Z0-9_]*$")
_DETAIL_KEY_PATTERN = re.compile(r"^[a-z][a-z0-9_]*$")
_CONTROL_CHAR_PATTERN = re.compile(r"[\x00-\x1f\x7f]")


def validate_error_details(details: ErrorDetails | None) -> ErrorDetails:
    """安全なスカラー値とキーのみを許可し、不変マッピングを返す。"""
    if not details:
        return MappingProxyType({})
    normalized: dict[str, ErrorDetailScalar] = {}
    for key, value in details.items():
        if not isinstance(key, str) or not _DETAIL_KEY_PATTERN.fullmatch(key):
            raise ValueError("details のキー形式が不正です。")
        if value is not None and not isinstance(value, bool | int | float | str):
            raise TypeError("details の値にはプリミティブ型のみ指定できます。")
        if isinstance(value, str) and _CONTROL_CHAR_PATTERN.search(value):
            raise ValueError("details の文字列値に制御文字は含められません。")
        normalized[key] = value
    return MappingProxyType(normalized)


class DomainError(Exception):
    """ドメインルール違反の基底例外（UI都合やPIIを含めない）。"""

    def __init__(
        self,
        message: str,
        *,
        code: str = "DOMAIN_ERROR",
        reason: str | None = None,
        action_hint: str | None = None,
        details: ErrorDetails | None = None,
    ) -> None:
        if not message or not message.strip():
            raise ValueError("例外メッセージは空にできません。")
        if not _ERROR_CODE_PATTERN.fullmatch(code):
            raise ValueError("不正なエラーコード形式です。")
        if reason is not None and not reason.strip():
            raise ValueError("reason は空にできません。")
        if action_hint is not None and not action_hint.strip():
            raise ValueError("action_hint は空にできません。")

        super().__init__(message)
        self._code = code
        self._message = message
        self._reason = reason if reason is not None else message
        self._action_hint = action_hint
        self._details = validate_error_details(details)

    @property
    def code(self) -> str:
        return self._code

    @property
    def message(self) -> str:
        return self._message

    @property
    def reason(self) -> str:
        return self._reason

    @property
    def action_hint(self) -> str | None:
        return self._action_hint

    @property
    def details(self) -> ErrorDetails:
        return self._details


class DomainAuthorizationError(DomainError):
    """ロール・資格・テナント境界などドメイン上の認可違反を表す例外。"""

    def __init__(
        self,
        message: str,
        *,
        code: str = "FORBIDDEN",
        reason: str | None = None,
        action_hint: str | None = None,
        details: ErrorDetails | None = None,
        conceal_as_not_found: bool = False,
    ) -> None:
        super().__init__(
            message,
            code=code,
            reason=reason,
            action_hint=action_hint,
            details=details,
        )
        self._conceal_as_not_found = conceal_as_not_found

    @property
    def conceal_as_not_found(self) -> bool:
        return self._conceal_as_not_found
```

### 5-2. アプリケーション層（`app/application/errors.py`）

```python
"""アプリケーション層の公開例外契約。"""

from typing import Literal

from app.domain.foundation.exceptions import (
    DomainAuthorizationError,
    DomainConflictError,
    DomainError,
    DomainNotFoundError,
    DomainValidationError,
    ErrorDetails,
)

type StateImpact = Literal["unchanged", "draft_preserved", "unknown"]


def from_domain_error(
    exc: DomainError,
    *,
    state_impact: StateImpact = "unchanged",
) -> ApplicationError:
    """ドメイン例外をアプリケーション層の公開例外へ変換する。"""
    if isinstance(exc, DomainNotFoundError):
        return ApplicationNotFoundError(
            exc.message,
            code=exc.code,
            reason=exc.reason,
            action_hint=exc.action_hint,
            details=exc.details,
            state_impact=state_impact,
        )
    if isinstance(exc, DomainConflictError):
        return ApplicationConflictError(
            exc.message,
            code=exc.code,
            reason=exc.reason,
            action_hint=exc.action_hint,
            details=exc.details,
            state_impact=state_impact,
        )
    if isinstance(exc, DomainAuthorizationError):
        return ApplicationAuthorizationError(
            exc.message,
            code=exc.code,
            reason=exc.reason,
            action_hint=exc.action_hint,
            details=exc.details,
            state_impact=state_impact,
            conceal_as_not_found=exc.conceal_as_not_found,
        )
    if isinstance(exc, DomainValidationError):
        return ApplicationValidationError(
            exc.message,
            code=exc.code,
            reason=exc.reason,
            action_hint=exc.action_hint,
            details=exc.details,
            state_impact=state_impact,
        )
    return ApplicationError(
        exc.message,
        code=exc.code,
        reason=exc.reason,
        action_hint=exc.action_hint,
        details=exc.details,
        state_impact=state_impact,
    )
```

### 5-3. プレゼンテーション層（`app/presentation/error_presenter.py`）

プレゼンテーション層は `ApplicationError` のみを参照し（`DomainError` を直接 import しない）、IDOR 秘匿（`conceal_as_not_found` → `404 NOT_FOUND`）・`state_impact` に基づく安全な `reassurance`・コード別カタログ・カテゴリ別 `actions` を組み合わせて `ErrorResponse` を返す。
