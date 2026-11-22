# 提供仕様書と公式情報の照合

確認日: **2026-11-15**。提供されたM3技術仕様書を出発点に、GoogleのMaterial公式サイト、Google管理のMaterial Web / Color Utilities、Android Developers、W3Cを確認した。M3サイトはJavaScript必須のページがあるため、tokens / states / shape / typography / motionはブラウザで本文を確認した。検索要約だけを根拠に確定していない。

## 判断結果

| 提供仕様書の記述 | 確認結果とSkillでの扱い |
|---|---|
| Reference / System / Componentの3層 | 公式の3クラスと整合。全値の3段参照やCSS変数化を必須にはしない |
| 13段階のtoneを生成 | 代表的なサンプルとして扱う。公式APIは0〜100のtoneを扱い、surface用の中間toneも必要 |
| 固定のLight/Dark tone表 | 従来の基準表として参照できる。dynamic schemeのvariant、contrast、仕様版による差を無視しない |
| errorは固定 | 任意の構成へ一般化しない。公式DynamicSchemeにはerrorPaletteの指定がある |
| Tone差40/50ならWCAGを保証 | 適合判定に使わない。通常文字4.5:1等の基準を、合成後の色で検証する |
| hover8%、focus/press10%、drag16% | 現行サイトと一致。旧Web v0.192のfocus/press12%とは版を分ける |
| State Layer色はon-* | contentの色に対応する。Text button等ではprimaryになり得る |
| disabled背景12%、前景38% | Filled button等の参照値。Text button等を含む全variantへ同じ背景を追加しない |
| Elevationの各levelがsurface-containerへ直結 | 一律の対応表として使わない。部品ごとのcontainer色と高さを独立に照合する |
| Typographyは全15スタイル | baselineは15。現行はemphasized15を加えて30と説明する |
| Shapeは7段階 | 従来の尺度。現行には20/32/48dpが加わり10段階 |
| 600/840の3サイズ分類 | 従来分類。Androidの現行分類には1200/1600dp境界もある。CSS px化はWeb側の設計判断 |
| ベジェ曲線がM3のmotion全体 | 従来方式。現行のphysics systemはspringを用いる |
| ヘッドレスUIへ外観を載せればM3完成 | 外観、意味、キーボード、focus、テーマ、動的状態を別々に検証する |

## 再確認の方法

該当分野の出典リンクは [foundations.md](foundations.md) と [type-layout-motion.md](type-layout-motion.md) に置いた。実装を始めるときは、対象部品の公式Specsと導入パッケージの版を確認し、参照した日付・版・差異を記録する。公式サイトの仕様世代、ライブラリのバージョン、トークンセットv0.192、Color Utilitiesの2021/2025設定を同一のバージョン番号として扱わない。

Material Webは公式README上でmaintenance modeとされる。旧Webのソースは具体的な値の証拠になるが、最新Expressiveの完全実装・新規採用の自動推奨を意味しない。既存ヘッドレスUIとCSS/StyleXによる実装も選択肢である。

出典: [Material Web README](https://github.com/material-components/material-web)。
