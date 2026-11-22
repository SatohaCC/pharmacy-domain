# Typography・Shape・Layout・Motion

2026-11-15確認。従来M3の数値を、現行M3全体の唯一の仕様として扱わない。

## Typography

基本はdisplay / headline / title / body / label × large / medium / smallの15スタイル。現行公式サイトは **15 baseline + 15 emphasized = 30** と説明する。基本15スタイルの採用は可能だが、Expressiveの対応まで完了したとは書かない。サイトではWebの基本スタイルとExpressiveで実装提供状況が異なるため、採用ライブラリを確認する。

旧Web v0.192を確認する際の基本15スタイル。size / line-heightはroot 16px換算のCSS px、trackingもCSS px。実装はrem等の拡大可能な単位と実フォントのメトリクスを考慮する。

| role | large | medium | small | weight (L/M/S) | tracking (L/M/S) |
|---|---|---|---|---|---|
| display | 57/64 | 45/52 | 36/44 | 400/400/400 | -0.25/0/0 |
| headline | 32/40 | 28/36 | 24/32 | 400/400/400 | 0/0/0 |
| title | 22/28 | 16/24 | 14/20 | 400/500/500 | 0/0.15/0.1 |
| body | 16/24 | 14/20 | 12/16 | 400/400/400 | 0.5/0.25/0.4 |
| label | 14/20 | 12/16 | 11/16 | 500/500/500 | 0.1/0.5/0.5 |

この数値をすべての言語へ固定しない。日本語フォールバック、行高、折り返し、文字拡大を確認し、単なる「太字化」をemphasized仕様の完全再現と呼ばない。font shorthandだけでtrackingが設定されると仮定しない。

出典: [現行Typography overview](https://m3.material.io/styles/typography/overview)、[旧Web typescale tokens](https://github.com/material-components/material-web/blob/main/tokens/versions/v0_192/_md-sys-typescale.scss)。

## Shape

従来の7段階はnone 0、extra-small 4、small 8、medium 12、large 16、extra-large 28、full。旧Web v0.192のfullは9999px。

現行サイトの尺度は **10段階**。上記にlarge-increased **20dp**、extra-large-increased **32dp**、extra-extra-large **48dp** が追加されている。各部品の既定の形・サイズ・状態も確認し、従来部品へ新しい角丸だけを一括上書きしない。

Webへの適用時は、横長要素の `border-radius: 50%` が丸薬形状と同じとは限らない点に注意する。fullは短辺に沿う十分大きな半径等で表現し、非正方形でも確認する。大きな角丸とoverflowで文字・focus ring・state layerを欠けさせない。

出典: [現行Corner radius scale](https://m3.material.io/styles/shape/corner-radius-scale)、[Shapeの更新](https://m3.material.io/styles/shape/overview-principles)、[旧Web shape tokens](https://github.com/material-components/material-web/blob/main/tokens/versions/v0_192/_md-sys-shape.scss)。

## Responsive / Adaptive

Android公式のwindow width分類はcompact <600dp、medium 600〜<840dp、expanded 840〜<1200dp、large 1200〜<1600dp、extra-large ≥1600dp。従来の3分類と、追加されたlarge / extra-largeを区別する。

これはAndroidのdpによるガイドであり、WebのCSS pxへの適用は設計上の判断として記録する。端末名で分岐せず、利用可能な幅・高さ・内容・ズームで判断する。navigation bar / rail / drawerや4/8/12列を、全画面への必須対応として固定しない。Webでは必要ならcontainer query等も検討する。

出典: [Android公式window size classes](https://developer.android.com/develop/ui/views/layout/use-window-size-classes)。

## Motion

現行M3は2025年のExpressive更新で、従来のeasing/duration中心からspringによるphysics systemへ移行している。expressive / standardのscheme、spatial / effects、fast / default / slowという役割で選ぶ。位置・大きさ等のspatialと、色・不透明度等のeffectsを区別し、色やopacityを意図せずオーバーシュートさせない。

元仕様書のベジェ曲線と固定msは従来方式の候補として保持できるが、最新spring仕様の再現とは呼ばない。既存の従来方式を無断で置換せず、対応するWeb実装・換算方法・ライブラリを公式Specsで確認する。

実装時は `prefers-reduced-motion`、中断・連続操作・最終状態を検証する。アニメーション完了だけを状態確定の条件にせず、モーションを低減しても操作と意味が成立するようにする。

出典: [Motion physics system](https://m3.material.io/styles/motion/overview/how-it-works)。
