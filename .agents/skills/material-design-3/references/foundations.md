# 色・状態・Elevation

2026-11-15確認。現在の公式サイトと、旧Material Webのトークン版v0.192を区別する。以下の実装上の注意は、出典をWebへ適用するための補足を含む。

## トークンとテーマ

`md.ref.*` は選択肢となる値、`md.sys.*` は意味と文脈、`md.comp.*` は部品の要素を表す。例えばFilled buttonのcontainerはprimary、contentはon-primaryへ対応させる。ComponentからSystemやReferenceへ対応を追える形にする。公式も「可能なら参照する」としており、全値を必ず3層経由にする規則ではない。

出典: [Design tokens](https://m3.material.io/foundations/design-tokens/overview)。実装時は既存のテーマ境界とSSR時の初期テーマを保ち、初回描画とクライアント更新で色が食い違わないか確認する。

## カラー生成

- HCTによる生成には公式の `@material/material-color-utilities` を候補にする。静的テーマも選べるため、すべてのUIに実行時の動的生成を要求しない。
- 「代表的な13 tone」は保存・表示のサンプルであり、使用可能なtoneの上限ではない。公式 `TonalPalette.tone(number)` は0〜100のtoneを扱う。surfaceで必要な4、6、12、17等を13個の表へ丸めない。
- source color、variant、light/dark、contrastLevel、利用する仕様版を記録する。最新のリポジトリにあるAPIが、導入済みnpm版にも存在するとは仮定しない。
- `DynamicScheme` の公式TS実装には2021/2025を区別する設定やerrorPaletteの指定がある。「errorはどのschemeでも固定」「すべてのロールが固定tone」と決めつけない。色生成のデフォルト仕様版と、UI全体のM3 Expressive採用は別の設定である。
- 使用するaccent、surface、outline、error、inverse、fixed等のロールを列挙し、対応する前景色を選ぶ。旧Webトークンのsurface階層を、任意の背景色と組み合わせない。

出典: [生成手順](https://github.com/material-foundation/material-color-utilities/blob/main/dev_guide/creating_color_scheme.md)、[TonalPalette](https://github.com/material-foundation/material-color-utilities/blob/main/typescript/palettes/tonal_palette.ts)、[DynamicScheme](https://github.com/material-foundation/material-color-utilities/blob/main/typescript/dynamiccolor/dynamic_scheme.ts)、[Webの色設定](https://material-web.dev/theming/color/)。固定のtone割当てを実装する場合の参照は [旧v0.192 color tokens](https://github.com/material-components/material-web/blob/main/tokens/versions/v0_192/_md-sys-color.scss)。

## State Layer

現行公式サイトの不透明度: hover **0.08**、focus **0.10**、press **0.10**、drag **0.16**。対して旧Web v0.192はfocus/pressが **0.12**。選んだ仕様の値を使い、差を修正漏れと即断しない。

State Layerはcontainerとcontentの間に置き、その部品のcontentに対応する色を使う。Filled buttonならon-primary、Text buttonならprimaryとなり、「常にon-*」ではない。複数の操作状態が重なってもState Layer自体を重ねて不透明度を加算しない。選択状態の見た目と操作状態は別に保持できる。

実装時の補足: 装飾用要素がクリックを奪わないようにし、文字やfocus indicatorを覆わない。`currentColor` を使う場合も、継承された色が目的のcontent色か確認する。hoverはホバー可能な入力で扱い、focus-visible、キーボードのpress、pointer cancel、disabledとの競合も確認する。

出典: [現行State layers](https://m3.material.io/foundations/interaction/states/state-layers)、[旧v0.192 state tokens](https://github.com/material-components/material-web/blob/main/tokens/versions/v0_192/_md-sys-state.scss)。

## Disabled・フォーカス・操作

旧Filled buttonのdisabledはcontainerにon-surface **0.12**、label/iconにon-surface **0.38**。これは全variant共通の背景指定ではない。Text buttonに同じ背景を追加しない。部品全体の `opacity: .38` で背景・文字・子孫を一括処理しない。

disabledのクリック抑止と見た目は別に扱う。native disabledとaria-disabledの違い、リンク・フォーム部品の意味、フォーカス可能性をヘッドレスUIのAPIに合わせる。Dialogはフォーカスの閉じ込め・Escape・復帰先・ラベルを確認する。

出典: [Filled button tokens](https://github.com/material-components/material-web/blob/main/tokens/versions/v0_192/_md-comp-filled-button.scss)、[Text button tokens](https://github.com/material-components/material-web/blob/main/tokens/versions/v0_192/_md-comp-text-button.scss)、[Web button API](https://material-web.dev/components/button/)、[WAI-ARIA Dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)。

## コントラスト

WCAG AAの通常テキストは **4.5:1**、大きな文字は **3:1**。大きな文字の条件は概ね18pt以上または14pt以上の太字であり、通常文字を3:1で合格にしない。識別に必要な非テキストのUI表示は隣接色との **3:1** を検証する。各基準の例外も確認する。

Tone差40/50は色設計の目安としても、任意の実装の適合保証には使わない。透明度の合成、状態、テーマの上書き後の色から相対輝度比を計算する。境界値を丸めて合格にしない。

出典: [WCAG 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)、[WCAG 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)。

## Elevation

旧Web v0.192のlevel 0〜5は **0 / 1 / 3 / 6 / 8 / 12**。これは高さの尺度であり、同じ順番でsurface-containerの色へ一律対応させる表ではない。container色・shadow・elevationは部品と状態ごとのトークンで決める。例えばFilled buttonは通常level0でもhover時はlevel1となる。

CSSのz-indexとelevationを同じ値にしない。ポップアップの重なり順、色による階層、影による奥行きを分けて確認する。

出典: [旧Elevation tokens](https://github.com/material-components/material-web/blob/main/tokens/versions/v0_192/_md-sys-elevation.scss)、上記Filled button tokens。
