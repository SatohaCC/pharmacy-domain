---
name: material-design-3
description: Material Design 3のWeb UI・デザインシステムを設計・実装・レビューするときに使う。トークン、テーマ、状態、アクセシビリティを公式仕様に照合し、従来M3・M3 Expressive・実装ライブラリの版を区別する。M3採用の指示がない既存UIを自動で全面変更しない。
---

# Material Design 3 のWeb実装

## 最初の判断

対象部品、既存のトークン・テーマ・ヘッドレスUI、参照するM3仕様の世代を確認する。既存の採用基準を維持し、新規なら従来M3とM3 Expressiveのどちらを目標にするか明示する。公式サイトの最新仕様と旧ライブラリの数値を無言で混ぜない。Skillの利用だけでUI変更や依存追加を開始しない。

常時読むのはこのファイルだけとし、対象に必要な参照を選ぶ。

- 色・テーマ・状態・Elevation: [foundations.md](references/foundations.md)
- 文字・角丸・レスポンシブ・モーション: [type-layout-motion.md](references/type-layout-motion.md)
- 元仕様書の妥当性確認、版の差、出典の確認: [verification.md](references/verification.md)

## 設計・実装の原則

- Reference → System → Componentの参照を追跡可能にする。色や寸法を部品へ散らさず、テーマは意味を持つロールの割当てで扱う。すべてを一律に3段のCSS変数へ展開する必要はない。
- 見た目、キーボード・フォーカス等の操作、アプリ固有のデータを分ける。既存のヘッドレスUIの契約を保ち、その上にM3の視覚表現を載せる。見た目がM3でもアクセシビリティが完成したとは判断しない。
- 各variantと状態について、container / content / state layer / outline / focus indicator / elevationの役割を確認する。disabledやhoverの共通数値を全コンポーネントへ機械的に適用しない。
- コントラストは最終的な前景色・背景色で検証する。Tone差だけでWCAG適合を保証しない。focus indicatorをState Layerやrippleだけで代用しない。
- CSS変数・StyleX等へのマッピングを記録する。`shared/ui`・`shared/components` を変更するときは、[共有 UI の設計規約](../../rules/frontend-shared-ui.md) のファイル構成と StyleX 分離に従う。M3採用を理由に既存のUIライブラリを交換しない。
- 参照資料の数値は版付きの基準値として扱う。厳密な再現や新API利用では、対象コンポーネントの公式Specsと導入済みパッケージの版・型定義を再確認する。取得できない仕様を確認済みと書かない。

## 完了の確認

対象に応じて、light/dark、操作状態、キーボード、disabled、長文・日本語・拡大表示、狭い幅、モーション低減を確認する。Dialogではフォーカス移動・閉じる操作・復帰も確認する。

Storybookで状態を分け、変更した見た目はブラウザで確認する。型検査やビルドの成功だけでスタイル適用・コントラスト・操作性を合格にしない。報告には採用した仕様世代・参照元、変更したロール、実施した検証と未確認事項を含める。
