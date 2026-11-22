# 共有 UI 設計・M3・StyleX 公開契約

確認日: 2026-11-21。`frontend/src/shared/ui/` および `frontend/src/shared/components/` の Material Design 3（M3）ロール対応、アクセシビリティ契約、StyleX 適用規約を記録する。

## 1. 採用した M3 仕様世代とテーマ基準

| 項目 | 採用基準 | 備考 |
| --- | --- | --- |
| カラーパレット・テーマ | テンプレート標準の明暗セマンティックトークン（[tokens.stylex.ts](../frontend/src/shared/styles/tokens.stylex.ts)） | `palette` → `tokens`（`@media (prefers-color-scheme: dark)`）の 2 層 + 部品側 `*.styles.ts` |
| コンポーネント寸法・形状基準 | Material Web `v0_192` 相当 + 独自調整 | 現行 M3 Expressive の spring physics・強調タイポグラフィ 30 スタイルは未採用 |
| State Layer 不透明度 | 現行 M3（hover `0.08` / focus `0.10` / press `0.10`） | `color-mix(in srgb, currentColor <ratio>, transparent)` で content 色から合成 |
| 角丸スケール | 現行 M3 10 段階トークン（`cornerNone` 0px 〜 `cornerFull` 9999px） | Button の `:active` 角丸変化のみ Expressive 風の `cornerMedium` (12px) を採用 |
| モーション | 従来 M3 easing（`160ms cubic-bezier(0.2, 0, 0, 1)`） | `prefers-reduced-motion: reduce` で `0s` |
| 無効状態表現 | Container `onSurface` 12%（`disabledContainer`）、Content `onSurface` 38%（`disabledContent`） | Text / Outlined 等の透明背景バリアントには塗り背景を追加しない |

## 2. コンポーネント別の M3 ロール対応表

| コンポーネント / バリアント | Container | Content / Label | Outline / Indicator | State Layer | Focus Indicator | Elevation |
| --- | --- | --- | --- | --- | --- | --- |
| `Button` (`filled`) | `primary` | `onPrimary` | — | `currentColor`（`onPrimary`） | `3px solid primary`（offset 3px） | hover 時 `shadow1` |
| `Button` (`tonal`) | `secondaryContainer` | `onSecondaryContainer` | — | `currentColor`（`onSecondaryContainer`） | `3px solid primary`（offset 3px） | `none` |
| `Button` (`outlined`) | `transparent` | `primary` | `outline` (1px) | `currentColor`（`primary`） | `3px solid primary`（offset 3px） | `none` |
| `Button` (`text`) | `transparent` | `primary` | — | `currentColor`（`primary`） | `3px solid primary`（offset 3px） | `none` |
| `Button` (`elevated`) | `surfaceContainerLow` | `primary` | — | `currentColor`（`primary`） | `3px solid primary`（offset 3px） | `shadow1` / hover 時 `shadow2` |
| `Tabs` (`primary` / `secondary`) | `surface`（リスト） | 非選択 `onSurfaceVariant` / 選択 primary=`primary`・secondary=`onSurface` | 選択インジケータ `primary`（3px / 2px）、下線 `outlineVariant` | `currentColor` | `3px solid primary`（offset -3px） | `none` |
| `Badge` (`neutral` / `success` / `danger`) | `surfaceContainerHighest` / `successContainer` / `errorContainer` | `onSurfaceVariant` / `onSuccessContainer` / `onErrorContainer` | — | なし（非インタラクティブ） | — | `none` |
| `StatusCard` | `surfaceContainerLow`（[StatusCard.styles.ts](../frontend/src/shared/components/status-card/StatusCard.styles.ts)） | `onSurface` + `Badge` + `Button` | `outlineVariant` (1px) | `Button` に委譲 | `Button` に委譲 | `none` |
| `Checkbox` | 40×40px 円形ヒット領域、box 18×18px（未選択 `transparent` / 選択 `primary` / 異常 `error`） | `onPrimary` / `onError`（チェック・不確定アイコン） | 未選択 `onSurfaceVariant` (2px) / 異常 `error` | ヒット領域 `currentColor` | `3px solid primary`（offset -2px） | `none` |
| `RadioGroup` | 40×40px 円形ヒット領域、ring 20×20px・dot 10×10px | dot: `primary`（異常時 `error`） | ring: `onSurfaceVariant` / 選択 `primary` / 異常 `error` (2px) | ヒット領域 `currentColor` | `3px solid primary`（offset -2px） | `none` |
| `Switch`（52×32px トラック） | オフ `surfaceContainerHighest` / オン `primary` | つまみ: オフ `outline`（hover/focus/active 時 `onSurfaceVariant`）、オン `onPrimary` | オフ `outline` (2px) / オン `primary` (2px) | トラック `currentColor`（オフ `onSurface` / オン `onPrimary`） | `3px solid primary`（offset 3px） | `none` |
| `Select` (`outlined` / `filled`) | `transparent` / `surfaceContainerHighest`、ポップアップ `surfaceContainer` | `onSurface`（placeholder `onSurfaceVariant`）、選択行 `secondaryContainer` / `onSecondaryContainer` | `outline` (1px) / 下線 `onSurfaceVariant`、異常 `error`、ポップアップ `outlineVariant` | `filled` トリガー・選択候補 `currentColor` | `3px solid primary`（offset 2px）＋内枠 1〜2px | ポップアップ `shadow2` |
| `TextField` (`outlined` / `filled`) | `transparent` / `surfaceContainerHighest` | `onSurface`（placeholder `onSurfaceVariant`） | `outline` (1px) / 下線 `onSurfaceVariant`、focus `primary`、異常 `error` | `filled` ホバー `currentColor` | `:focus-within` `3px solid primary`（offset 2px） | `none` |
| `Dialog` | `surfaceContainerHigh`、スクラム `scrim` | `onSurface`（タイトル・本文）、`onSurfaceVariant`（説明・閉じるアイコン） | `outlineVariant` (1px) | 閉じるアイコンボタン `currentColor` | `3px solid primary`（offset 2px） | `shadow3` |
| `Alert` (`info` / `success` / `warning` / `error`) | `tertiaryContainer` / `successContainer` / `warningContainer` / `errorContainer` | `onTertiaryContainer` / `onSuccessContainer` / `onWarningContainer` / `onErrorContainer` | `outlineVariant` (1px) | 閉じるボタン `currentColor`（`action` は子要素に委譲） | `3px solid primary`（offset 2px） | `none` |
| `ToastViewport` (`default` / `info` / `success` / `warning` / `error`) | `inverseSurface` / `tertiaryContainer` / `successContainer` / `warningContainer` / `errorContainer` | `inverseOnSurface`（アクション `inversePrimary`） / 各 `on*Container` | `outlineVariant` (1px) | アクション・閉じるボタン `currentColor` | `3px solid primary`（`default` / `loading` 内ボタンは `inverseOnSurface`、offset 2px） | `shadow3` |
| `Spinner` | `transparent` | 回転リング枠 `outlineVariant` + 上辺 `primary`・ラベル `onSurface` | — | なし（非インタラクティブ） | — | `none` |
| `Skeleton` | `surfaceContainerHighest` | なし（`aria-hidden="true"` 装飾） | — | なし（非インタラクティブ） | — | `none` |
| `Textarea` (`outlined` / `filled`) | `transparent` / `surfaceContainerHighest` | `onSurface`（placeholder `onSurfaceVariant`） | `outline` (1px) / 下線 `onSurfaceVariant`、focus `primary`、異常 `error` | `filled` ホバー `currentColor` | `:focus-within` `3px solid primary`（offset 2px） | `none` |
| `Menu` | ポップアップ `surfaceContainer`（トリガーは `Button` 共有スタイル） | `onSurface`（破壊的操作 `error`、無効 `disabledContent`） | `outlineVariant` (1px)（区切り線も `outlineVariant`） | 項目ハイライト `stateHover` | トリガー `3px solid primary`（offset 3px）・項目ハイライト表示 | `shadow2` |
| `Tooltip` | `inverseSurface`（トリガーは `Button` 共有スタイルまたは `triggerRender`） | `inverseOnSurface`（ショートカット `opacity: 0.85`） | — | トリガーに委譲 | トリガーに委譲 | `shadow1` |

> [!NOTE]
> `Switch` のオン状態 State Layer について: 旧 Material Web `v0_192` はつまみ周囲のハローに `primary` を用いる設計であるのに対し、本実装はトラック全体に `currentColor`（オン時は content 色 `onPrimary`）を重ねる方式を採用した。一方、オフ状態の hover/focus/active では `onSurface` 10% のトラック加算により `outline` とのコントラストが 3:1 を下回る（ライト `2.84:1`・ダーク `2.89:1`）ため、M3 仕様どおり操作中のつまみ色を `onSurfaceVariant` へ切り替えている。

## 3. 明暗テーマの実測コントラスト比（Chromium 計測）

Storybook ビルドを Chromium で描画し、背景色と透過 State Layer（`color-mix`）を合成したうえで算出した値。

| 対象 | 基準 | ライト | ダーク | 備考 |
| --- | --- | --- | --- | --- |
| `Button`（Elevated / Filled / Tonal / Outlined / Text）通常 | ≥ 4.5:1 | 5.76 / 6.36 / 13.28 / 6.03 / 6.03 | 9.83 / 7.72 / 7.23 / 10.83 / 10.83 | すべて合格 |
| `Button`（Elevated / Filled / Tonal / Outlined / Text）`:hover` | ≥ 4.5:1 | 5.14 / 5.36 / 11.49 / 5.35 / 5.35 | 8.28 / 6.77 / 5.99 / 9.37 / 9.37 | すべて合格 |
| `Tabs`（選択 / 非選択） | ≥ 4.5:1 | 6.03 / 8.84 | 10.83 / 10.94 | すべて合格 |
| `Badge`（neutral / success / danger） | ≥ 4.5:1 | 7.22 / 8.97 / 12.77 | 7.03 / 8.04 / 7.17 | すべて合格 |
| `Switch` つまみ対トラック（オフ通常 / オフ hover / オン通常 / オン hover） | ≥ 3.0:1 | 3.45 / 6.20 / 6.36 / 5.36 | 3.76 / 5.68 / 7.72 / 6.77 | 非テキスト UI 基準合格 |
| `Checkbox`（未選択枠 / 選択塗り / 異常枠） | ≥ 3.0:1 | 8.84 / 6.03 / 6.20 | 10.94 / 10.83 / 10.79 | 非テキスト UI 基準合格 |
| `RadioGroup`（選択リング / 未選択リング） | ≥ 3.0:1 | 6.03 / 8.84 | 10.83 / 10.94 | 非テキスト UI 基準合格 |
| `TextField`（Outlined / Filled 本文） | ≥ 4.5:1 | 15.88 / 12.95 | 14.27 / 9.16 | すべて合格 |
| `Select`（Outlined / Filled 本文） | ≥ 4.5:1 | 15.88 / 12.95 | 14.27 / 9.16 | すべて合格 |
| `Dialog`（タイトル / 説明本文） | ≥ 4.5:1 | 13.70 / 7.63 | 10.75 / 8.25 | すべて合格 |
| `Alert`（info / success / warning / error） | ≥ 4.5:1 | 13.26 / 8.97 / 11.16 / 12.77 | 7.19 / 8.04 / 8.58 / 7.17 | すべて合格 |
| `ToastViewport`（default 本文 / default アクション / success / error） | ≥ 4.5:1 | 11.88 / 7.70 / 8.97 / 12.77 | 12.95 / 7.21 / 8.04 / 7.17 | すべて合格 |
| `Spinner`（ラベル） | ≥ 4.5:1 | 15.88 | 14.27 | 合格 |
| `Textarea`（Outlined / Filled 本文 / エラー本文） | ≥ 4.5:1 | 15.88 / 12.95 / 6.20 | 14.27 / 9.16 / 10.79 | すべて合格 |
| `Menu`（通常項目 / 破壊的項目） | ≥ 4.5:1 | 14.37 / 5.61 | 12.37 / 9.36 | すべて合格 |
| `Tooltip`（本文） | ≥ 4.5:1 | 11.88 | 12.95 | 合格 |

- **無効状態の例外**: Disabled 状態の文字色（`disabledContent`: 不透明度 38%）および背景・枠線（`disabledContainer`: 不透明度 12%）は、WCAG 2.2（1.4.3 / 1.4.11）の「非アクティブなユーザーインタフェースコンポーネント」の例外に該当し、操作不能な状態を視覚的に区別するため意図的にコントラストを抑えている。

## 4. 表示ラベルなし利用・`invalid`・外部 `Field` 契約

`Checkbox`・`RadioGroup`・`Switch`・`Textarea` は表示ラベル（`label`）を省略できる。利用形態ごとの契約は以下のとおり。

1. **ARIA 属性による単体命名**
   - `aria-label` または `aria-labelledby` を渡す。補足説明を外部要素で持つ場合は `aria-describedby` を渡す（`Checkbox`・`RadioGroup`・`Switch`・`Textarea` ともユーザー操作や再描画後も元の `aria-describedby` とエラー参照の両方を保持する）。
   - `label`・`description`・`errorMessage` の有無を動的に切り替えても、内部の `<Field>` 構造が維持されるためフォーカスと非制御入力値はリセットされない。
2. **外部 `@ui-sdk/react/field` の `Field` 内包**
   - 外部 `<Field>` 内で `label`・`description`・`errorMessage` を渡さずに配置した場合、`useFieldControl()` により外部 `Field` の存在を検出し、内側で `<Field>` を重ねない。外部の `FieldLabel`・`FieldDescription`・`FieldError`・`disabled`・`invalid`・`name` がそのままコントロールへ接続される。
   - `shared/components` や `features/*` では `@ui-sdk/*` の直接 import が禁止されているため、アプリ側では原則 `label` / `description` / `errorMessage` Props を経由して使用する。
3. **`invalid` と `errorMessage` の優先規則**
   - `invalid` 未指定時は `errorMessage` の有無から推論する（`errorMessage` あり → `true`、なし → `undefined` としてブラウザの `required` 等ネイティブ制約検証に従う）。
   - `invalid={true}` はラベル有無にかかわらず対象コントロール（`RadioGroup` では `role="radiogroup"` と各 `radio` の双方）に `aria-invalid="true"` を設定する。
   - `invalid={false}` を明示した場合、`errorMessage` が同時に渡されてもエラー表示・`aria-invalid="true"`・`aria-describedby` のエラー参照を抑止する（`Checkbox`・`RadioGroup`・`Select`・`TextField`・`Textarea` で共通）。

## 5. StyleX オーバーライド適用契約と CSS レイヤー

- **CSS レイヤー順序（[globals.css](../frontend/src/app/globals.css)）**
  - 先頭に `@layer ui-sdk, reset;` を宣言し、`@layer ui-sdk` 内に `[data-slot][hidden]:not([hidden="until-found"])` の非表示規則を置いた上で `@stylex;` と `@layer reset` を配置する。
  - Next.js 本番ビルドは Babel + `@stylexjs/postcss-plugin`（`useCSSLayers: true`）で静的に CSS を抽出し、Storybook と Vitest は [stylexVitePlugin.mts](../frontend/config/stylexVitePlugin.mts)（`runtimeInjection: true`）で変換する。
- **`style?: StyleXStyles` の適用先**
  - `Button`・`Badge`・`Tabs`・`Alert`・`Spinner`・`Skeleton`・`ToastViewport`: 各ルート要素に `{...stylex.props(..., style)}` で適用。
  - `TextField`・`Select`: `<Field>` ルート要素に適用。
  - `Dialog`: `<DialogContent>`（`role="dialog"` 本体）に適用。
  - `Menu`・`Tooltip`: `style` はポップアップ本体（`<MenuContent>` / `<TooltipContent>`）に適用し、`Menu` の `triggerStyle` は `<MenuTrigger>`、`Tooltip` の `triggerStyle` は `triggerRender` 未指定時の既定トリガーに適用する（`triggerRender` 指定時は渡す側要素のスタイルを保持）。
  - `Checkbox`・`Switch`・`RadioGroup`・`Textarea`:
    - 単体表示（`label`・`description`・表示対象 `errorMessage` がすべて無し、または外部 `<Field>` 内）ではコントロール本体（`role="checkbox"` / `role="switch"` / `role="radiogroup"` / `Textarea` の制御枠）にスタイルを適用する（`Checkbox`・`Switch`・`RadioGroup` は `className` とインライン `style` の両方を渡す）。
    - 自身の `label`・`description`・表示対象 `errorMessage` を持つ場合は外側の `<Field>`（`[data-slot="field"]`）へ適用する。

## 6. ブランドテーマの差し替え（`stylex.createTheme`）

[tokens.stylex.ts](../frontend/src/shared/styles/tokens.stylex.ts) の `tokens` は `stylex.defineVars(...)` で定義されており、`stylex.createTheme(tokens, ...)` を使うことでコンポーネント側のコードを変更せずにサブツリー単位またはアプリ全体の配色を差し替えられる。実装例は [brandTheme.ts](../frontend/src/shared/styles/brandTheme.ts) と Storybook（`shared/styles/ThemeOverride`）を参照すること。

1. **テーマ定義の基本ルール**
   - 第 1 引数の `tokens` は StyleX コンパイラで静的解決できるよう、相対パス（`./tokens.stylex` 等）で import する。
   - `primary` / `onPrimary` / `primaryContainer` / `onPrimaryContainer` / `secondary` などのセマンティックトークンを上書きする際は、`{ default: ..., "@media (prefers-color-scheme: dark)": ... }` の形式でライト・ダーク双方の値を定義する。
   - 定義したテーマはルートコンテナ（例: `<body>` やセクションルート）へ `{...stylex.props(indigoBrandTheme)}` として渡すだけで子孫の共有 UI に伝播する。
2. **差し替え後の検証手順**
   - `pnpm check`・`pnpm test`・`pnpm build` に加え、`pnpm test:storybook` を実行して全ストーリーの描画および StyleX クラス生成を Chromium 上で確認する。
   - 変更したカラーロール（`Button` / `Tabs` / `Switch` 等）について、ライト・ダーク両テーマおよび `:hover` 合成後を含めて通常文字 `≥ 4.5:1`・非テキスト UI `≥ 3.0:1` のコントラスト比を満たすことを確認する（計測手法は [contrast.ts](../frontend/storybook-tests/contrast.ts) を参照）。
