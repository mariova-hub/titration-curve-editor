# titration-curve-editor UI・SVG/PNG描画・Rendering Test仕様書

- 文書状態: 実装前の正式UI/描画契約
- 対象: UI / Rendering / Export / Rendering Test
- 関連文書: [project-specification.md](./project-specification.md)、[calculation-spec.md](./calculation-spec.md)

## 1. 目的

本書は、化学計算済みの`TitrationResult`を、試験問題・教材へ使用できる編集可能な図版としてPreviewし、SVG/PNGへ出力する仕様を定める。UIは化学計算条件と図版スタイルを分離し、Renderingは化学計算を行わない。PreviewとSVG Exportは同じrendererと描画モデルを使い、PNGはそのSVGから派生させる。

## 2. UIの基本構成

デスクトップ幅では、左側をControls、右側をPreviewとする。

```text
+---------------------------+--------------------------------------+
| Controls                  | Preview                              |
|                           |                                      |
| Titration                 |        rendered SVG figure           |
| Curve Style               |                                      |
| Axes                      |                                      |
| Ticks                     |                                      |
| Guides / Markers          |                                      |
| Figure Size               |                                      |
| Export                    |                                      |
+---------------------------+--------------------------------------+
```

- Controlsはカテゴリ単位で明確に分ける。
- UIの標準表示言語は日本語とする。内部identifierと、pH、SVG、PNG、mol/L、mL等の標準表記はこの限りではない。物質マスターのcanonical formulaはASCIIのまま保持し、Substance selectでは表示専用utilityにより数字0〜9をUnicode下付きへ変換する。電荷上付きへの一般化はMVP対象外とする。
- Previewは設定変更後の同一SVG描画結果を表示する。
- 狭い画面では上下配置へ切り替えてよいが、入力項目・意味・描画結果を変更しない。
- MVPはローカルブラウザだけで動作し、ログインやクラウド保存を要求しない。
- 初期フォーカス、labelとform controlの関連付け、keyboard操作、エラーのテキスト通知を確保する。

## 3. UI状態と更新フロー

UI状態を最低限、次の3領域に分ける。

```ts
interface AppState {
  titrationDraft: TitrationInputDraft;
  calculation:
    | { status: "idle" }
    | { status: "validating" }
    | { status: "calculating" }
    | { status: "success"; result: TitrationResult }
    | { status: "error"; message: string; errorCode: string };
  graphStyle: GraphStyle;
}
```

- `titrationDraft`は未確定のUI文字列を持てるが、Calculationへ渡す前に正規化・validationする。
- `TitrationResult`は計算結果であり、style変更で再計算しない。
- `GraphStyle`は図版設定であり、化学入力・計算点を含めない。
- 化学入力またはsampling設定の変更時だけ計算を再実行する。
- axis、tick、guide、色、線幅、figure size、縦横比、typographyの変更ではrendererだけを再実行する。
- 入力エラー・未対応系・収束失敗時は旧曲線を新しい入力の結果として表示せず、明確なエラー状態を示してExportを無効化する。

## 4. Controlsカテゴリ

Controlsは次のカテゴリを持つ。

1. Titration
2. Curve Style
3. Axes
4. Ticks
5. Guides / Markers
6. Figure Size
7. Export

AxesとTicksを見た目上別カテゴリにしても、状態モデルではX/Y各`AxisStyle`へ一貫して保存する。項目の重複source of truthを作らない。

## 5. Titration入力

### 5.1 Analyte

- `substance`: MVP物質マスターから選択
- `concentration`: mol/L、正のfinite値
- `volume`: UI表示はmL、正のfinite値。Domain境界でLへ変換

### 5.2 Titrant

- `substance`: MVP物質マスターから選択
- `concentration`: mol/L、正のfinite値

### 5.3 計算範囲とsampling

最大滴下体積は、全対象当量点と過剰滴下域が見える自動提案を基本とし、必要なら入力可能にする。自動値の決定規則はCalculation/Sampling側に置く。計算点数または品質設定をUIへ出す場合も、axis tick数とは別項目にする。

### 5.4 validation表示

- 必須、数値形式、正値、範囲をfield単位で表示する。
- 酸と酸、塩基と塩基、必要定数欠落、設計上未対応の系を区別する。
- エラー時に入力値を暗黙補正しない。
- `NaN`や`Infinity`相当の文字列を受理しない。
- 25 ℃固定であることをUIまたは情報表示で明示し、温度controlはMVPで設けない。

## 6. Curve Style

曲線は`LineStyle`で管理する。

| 設定 | 必須値・挙動 |
|---|---|
| line width | 正のfinite px値。SVGの`stroke-width`へ反映 |
| line pattern | `solid` / `dashed` / `dotted` / `dash-dot` |
| line color | 有効な色。Exam初期値はblack |

patternはrenderer内の単一mappingで`stroke-dasharray`へ変換する。値は線幅に対して視認可能で、Preview/Export間で同一とする。

```ts
const conceptualPatternMap = {
  solid: undefined,
  dashed: "8 4",
  dotted: "1 3",
  "dash-dot": "8 3 1 3",
};
```

上記数値は概念初期値であり、実装開始前または描画検証時に固定する。`solid`では`stroke-dasharray`を出力しない。丸いdotが必要な場合の`stroke-linecap`もrenderer全体で統一する。

## 7. Axes / Ticks

### 7.1 X/Y独立設定

X軸とY軸はそれぞれ次を独立に持つ。

- `visible`: 軸線・tickの全体表示
- `label`: 文字列
- `label visible`: 軸labelのON/OFF
- `min`
- `max`
- `major tick interval`
- `minor tick interval`
- `tick labels visible`: 目盛り数値のON/OFF
- `line width`
- `line type`: solid / dashed / dotted / dash-dot
- `line color`
- `tick length`
- `tick width`
- `tick direction`: outside / inside / both
- `show zero label`: 原点0の数値表示ON/OFF
- `axis label position`: auto / custom、軸上位置、軸からの距離
- `axis label orientation`: Y軸のみhorizontal / counterclockwise / clockwise

`min < max`を必須とする。X軸単位は表示上mL、Calculation結果はLで保持し、座標変換前のview modelで明示的に変換する。Y軸はpHである。

### 7.2 標準設定

- Y軸範囲: 0–14
- Y軸major tick初期候補: 2
- Y軸minor tick: OFF
- X軸: auto nice ticks
- X軸のmajor tick数: 概ね4〜7個を目標
- 試験問題用では、計算点が高密度でもtickを少数表示にできる

Y軸0–14は表示範囲であり、計算pHを0–14へclipまたは補正してはならない。範囲外の線分はplot areaの`clipPath`で視覚的に切る。

### 7.3 nice ticks

auto major tickは表示rangeから`1, 2, 2.5, 5 × 10^n`等のnice interval候補を選び、原則4〜7個にする。明示intervalが指定された場合は自動tick数目標より優先する。浮動小数点累積加算で重複・端点越えを生まないよう、整数indexからtick値を生成する。

tick生成はsampling点から独立し、curve point数や当量点数を増減しても、同じaxis設定なら同じtick列を返す。

### 7.4 軸・label・tickの表示関係

- `axis.visible = false`では、その軸線、major/minor tick、tick labelsを描かない。
- 軸labelは`labelVisible`で個別制御する。axis非表示時にlabelだけ表示するかはMVPでは「表示しない」に統一する。
- `tickLabelsVisible = false`でも軸線とtick markは表示できる。
- minor tickが`off`ならminor tick要素を生成しない。
- Graph title、X label、Y label、tick labels、grid、equivalence guide、characteristic markerはそれぞれ独立設定とする。

### 7.5 目盛り方向と原点表示

- `outside`はplot外側、`inside`はplot内側、`both`は`tickLength`を軸中心で半分ずつ内外へ伸ばす。
- major/minor tickへ同じ方向を適用する。X/Yは独立設定とする。
- marginへ加えるtick長はoutsideの全長、bothの半分、insideは0とする。tick labelは常に外側へ配置する。
- `showZeroLabel = false`では、数値誤差を考慮して0と判定したmajor tickのtextだけを省略する。tick mark、軸線、0以外のlabelは残す。

### 7.6 軸ラベル位置

- `auto`は既存の中央位置とmarginを維持する。
- `custom`では`alongAxis`を0〜1で指定する。X軸は左から右、Y軸は下から上へ増加する。
- `offsetPx`は軸から外側への距離とし、UIでは0〜100 pxに制限する。Y軸labelのrotation中心は指定後のX/Y座標と一致させる。
- 目盛り方向・原点表示・軸ラベル位置の変更はrendererだけを再実行する。
- Y軸ラベルは横書き（`0`）、左90°（`-90`）、右90°（`+90`）を水平text基準の絶対向きとして選択可能とし、既定は従来どおり左90°とする。auto/custom、`alongAxis`、`offsetPx`で先に座標を決定し、その座標を必要な場合の単一rotation中心に用いる。横書きではtransformを生成せず、既存transformへのrotation連結は禁止する。±90°間ではmarginを維持し、横書きでは簡易文字幅推定を左marginへ反映する。

## 8. Guides / Markers

### 8.1 データ構造

Renderingは`TitrationResult.equivalencePoints: EquivalencePoint[]`および`characteristicPoints: CharacteristicPoint[]`を入力とする。単数の当量点volumeを前提にしない。

GraphStyleは次の両方を持つ。

- `allEquivalencePointsVisible`: 全理論当量点の一括ON/OFF
- `equivalencePointVisibility: Record<id, boolean>`: 個別表示の将来/UI拡張用
- `characteristicPointVisibility: Record<id, boolean>`: 半当量点等の個別表示用

MVP UIは最低限「全当量点ON/OFF」を提供すればよい。ただしrenderer、style状態、SVG要素ID、テストは複数件を処理する。未知IDは無視してよいが、配列の先頭だけへ暗黙適用してはならない。

### 8.2 表示対象

- all equivalence points
- individual equivalence point
- half-equivalence points
- other characteristic points

guideは既定で縦線とし、plot area内でclipする。marker/annotationを将来追加できるが、MVPで未定義のラベルを自動生成しない。当量点pHや特徴点pHはCalculation結果を使い、SVG pathから推定しない。

## 9. Presets

Presetは`GraphStyle`へ既定値を適用する操作である。Preset適用後、すべての項目を個別変更でき、presetへ自動的に戻さない。

### 9.1 Exam

- figure 320×240 px、4:3
- white background
- black curve、solid、width 2 px
- black axes、solid、width 2 px
- major tick width 1.5 px
- tick labels 10.5 pt、axis labels 10.5 pt、title 13.5 pt
- solid curve
- simple ticks
- no grid
- no title
- no equivalence guides
- no characteristic markers
- no annotations

Microsoft Wordの試験問題でコピー・印刷しやすい小型モノクロ図を生成する。PNG固有の線幅・font補正は行わず、同じGraphStyleをSVG/PNGへ反映する。axis labelとtick labelは個別ON/OFF可能である。

### 9.2 Teaching

- axis labels visible
- equivalence guides visible
- optional grids（preset適用時の既定ON/OFFは受入れ前に固定）
- curveとguideを識別可能なstyle

Teachingも化学計算を変更しない。Preset切替でsamplingを変えない。

### 9.3 Custom状態

Preset適用後の個別変更は`presetOrigin`を履歴情報として残してもよいが、描画値は現在の`GraphStyle`を唯一の正とする。「Examだから変更不可」の条件分岐は禁止する。

## 10. Figure Size

- widthとheightを正のfinite px値で指定する。
- 「縦横比を固定」のON/OFF、横比率、縦比率をUI状態として持つ。比率は整数に限定せず、各値を正のfinite値とする。
- 縦横比presetは少なくとも自由、1:1、4:3、3:2、16:9を持つ。preset適用後も任意比率へ変更できる。
- 固定ONではwidth変更に追従してheightを、height変更に追従してwidthを更新する。固定OFFではwidthとheightを独立に変更する。循環更新を起こさない。
- SVG rootは指定width/heightとviewBoxを持つ。
- plot marginはtitle、axis label、tick labelのpt指定を`1 pt = 4 / 3` user unitへ換算し、文字が切れない値を描画モデルで決定する。
- 極端に小さいfigure sizeでplot areaが正にならない場合はvalidation errorとする。
- Preview表示のCSS縮小はSVG内部座標、線幅、Export寸法を変更しない。
- backgroundは`white`または`transparent`。Examはwhite。

### 10.1 Typography

`GraphStyle`は、目盛り数値、X/Y軸ラベル、タイトルのfont sizeとfont familyを3系統で独立して保持する。各font size fieldは接尾辞`Pt`でpt単位を明示し、正のfinite値とする。UIは6〜48 pt、step 0.5を基本とし、SVG textの`font-size`属性には`pt`を付ける。layout/marginのみ共通utilityで`1 pt = 96 / 72 = 4 / 3` SVG user unitへ換算し、経験的な換算係数を追加しない。各font familyは空でない文字列とし、renderer内へ固定font設定を残さない。ゴシック体、明朝体、MS系日本語フォント、sans-serif、serif、Century、任意指定を各系統のUIで提供し、属性値はXML escapeする。Century stackは`"Century", "Yu Mincho", "MS Mincho", serif`とし、英数字ではCenturyを優先し、日本語グリフは後続fontへfallbackする。Exam presetは10.5 / 10.5 / 13.5 pt、Teaching presetは10 / 11 / 14 ptとし、適用後の個別変更を許可する。SVGへフォントファイルやweb fontを埋め込まず、別環境ではfallbackされることをUI/READMEへ明記する。font変更はcurve point、sampling、化学計算結果を変更しない。

## 11. Rendering pipeline

### 11.1 単一renderer原則

```text
TitrationResult + GraphStyle
             ↓
      Graph Render Model
             ↓
        SVG Renderer
          ↙       ↘
   Preview DOM   serialized SVG Export
                         ↓
                    PNG conversion
```

Preview専用とExport専用に描画ロジックを複製しない。推奨方式は、純粋関数でSVG element treeまたはSVG文字列を1回生成し、Previewはそれを表示、Exportは同一結果をserializeする方式である。

### 11.2 Graph render model

render modelは少なくとも次を確定済み値として持つ。

- figure/viewBox寸法
- plot area rectangleとclip ID
- X/Y scale domain/range
- curveのplot座標列
- axis line、major/minor ticks、formatted labels
- title、axis labels
- grid lines
- 全equivalence/characteristic guideのIDと座標・style・visibility
- background

化学species、Ka、mass balanceをrender modelで再解釈しない。

## 12. SVG仕様

### 12.1 rootとviewBox

- root要素はSVG namespaceを持つ。
- `viewBox="0 0 width height"`を基本とする。
- Exportでは必要な`width`、`height`を明示する。
- CSS外部依存を避け、出力単体で見た目を再現できる属性または内部styleを用いる。
- deterministicな属性・要素順にし、テストと差分確認を容易にする。

### 12.2 推奨要素構造

```xml
<svg ...>
  <defs>
    <clipPath id="plot-clip">...</clipPath>
  </defs>
  <rect data-role="background" ... />
  <g data-role="title">...</g>
  <g data-role="grid">...</g>
  <g data-role="axes">...</g>
  <g data-role="guides" clip-path="url(#plot-clip)">...</g>
  <g data-role="curve" clip-path="url(#plot-clip)">
    <path ... />
  </g>
  <g data-role="annotations">...</g>
</svg>
```

`data-role`と各特徴点の安定した`data-id`をテスト用・識別用に用いる。ID衝突を防ぐため、複数SVGを同一documentにPreviewする可能性を考慮してclip IDへrenderer instanceの決定的prefixを付けるか、参照範囲を管理する。

### 12.3 curve

- MVPは計算点を通るSVG `path`または`polyline`を用いる。
- `fill="none"`、style由来の`stroke`、`stroke-width`、必要な`stroke-dasharray`を設定する。
- volumeはLから表示mLへ明示変換後にX scaleへ渡す。
- pHは内部値からY scaleへ直接写像し、丸めない。
- plot areaに`clipPath`を適用する。
- 計算失敗点、NaN/Infinity座標を除外して線をつなぐのではなく、Rendering入力自体をerrorとして拒否する。
- splineによるovershootはMVPでは使用しない。

### 12.4 axes、ticks、grid、text

- axis、ticks、grid、guidesは個別のgroupへ分ける。
- line width、line pattern、line colorを対応するstyleから反映する。
- title、axis labels、tick labelsはSVG `text`要素を用いる。
- Y-axis labelの回転などtransformはdeterministicにする。
- 数値formatは表示精度設定で行い、`-0`を表示しない。
- 非表示項目は、`display:none`で残すより要素を生成しない方式を基本とし、構造テストを明瞭にする。
- gridのtick sourceはaxis tick modelを共有するが、grid visibilityはaxis/tick visibilityと独立させる。

### 12.5 background

- `white`: viewBox全体の白い`rect`を生成する。
- `transparent`: 背景rectを生成しない、または`fill="none"`とする方式を1つに固定する。
- PNG変換時も同じ背景設定を反映する。

## 13. SVG Export

- Preview生成に用いた同一render modelとrenderer結果をserializeする。
- Export直前に化学再計算や別のtick生成を行わない。
- XML/SVGとして単体で開ける内容にする。
- titleやmetadataを追加する場合も、図中title visibilityとは別概念として扱う。
- ファイル名既定値の規則は実装Phaseで固定するが、物質名等を安全な文字へ変換し、空名にしない。
- Export対象がerror/計算中の場合は操作を無効化する。

## 14. PNG Export

PNGはSVG出力をCanvas等へ描画して生成する。独立した座標計算、axis生成、curve描画を実装しない。

`PngExportOptions`は`scale`と`background`を持つ。UIは1倍・2倍・4倍を維持し、Word貼り付け・印刷の標準は2倍、高解像度用途には4倍を利用可能とする。scaleはSVGの論理寸法やGraphStyleを変更せず、Canvas幅・高さだけへ乗算する。背景は`preserve`（SVG設定を使用）、`white`、`transparent`を扱う。transparent指定時はrendererが生成した背景rectだけをrasterize用SVGから除外し、white指定時は描画前にCanvasを白でfillする。

推奨手順:

1. 同一rendererのSVGをserializeする。
2. SVGをBlob/data URL等の安全なブラウザ内表現へ変換する。
3. Imageまたは`createImageBitmap`で読み込む。
4. 指定pixel寸法のCanvasへ描画する。
5. CanvasからPNG Blobを生成する。
6. Object URL等の一時resourceを解放する。

transparent backgroundはPNG alphaとして保持し、whiteはSVG背景rectを含めた状態で変換する。変換失敗、tainted canvas、0寸法、非finite寸法を明示的なExport errorとして扱う。

PNG MIMEは`image/png`、既定filenameは`titration-curve.png`とする。拡張子がなければ`.png`を補い、重複させない。Canvasは一辺16,384pxかつ総画素数100MP以下とし、通常の720×480・2倍と最大figure 2400×1800・4倍を許容する。document fontsのreadyを可能な範囲で待ってからImageへ読み込み、SVG読込用・PNG download用Object URLを成功・失敗双方で解放する。変換中は二重実行を防止し、stale Previewでは操作を無効化する。PNG失敗は日本語errorとして表示するが、SVG Exportを無効化しない。

## 15. PreviewとExportの一貫性

一貫性とは、同じ`TitrationResult`と`GraphStyle`に対し、次が同一であることをいう。

- curve point列とpath data
- viewBox、plot area、scale
- axis/tick/grid/guideの有無・位置
- line width、pattern、color
- title/label/text内容
- background

PreviewコンテナのCSS scaleやUI枠は比較対象外である。DOM挿入時のブラウザ正規化がある場合、serialization文字列の完全一致だけに頼らず、同一renderer呼出しと正規化後の構造・主要属性一致を検証する。

## 16. 必須Rendering/UI tests

Vitestと、必要最小限のDOM環境を想定する。外観snapshotだけに依存せず、意味のある構造・属性をassertする。

### 16.1 SVG structure

- rootが`svg`、namespace、viewBox、width、heightを持つ
- `defs/clipPath`とplot areaが存在する
- curveとguide groupがclipPathを参照する
- 必須groupがdeterministicな順序・`data-role`を持つ
- 同じ入力で同じ構造を生成する

### 16.2 curve existence

- 2点以上のfixtureでcurve `path`または`polyline`が1つ以上存在する
- `fill="none"`である
- path data/pointsが空でない
- 全座標がfiniteである
- 入力CurvePointの順序と対応する

### 16.3 axis existence / visibility

- X/Y各axisを独立に表示・非表示できる
- axis非表示時に対応axis/tick/labelを生成しない
- axis labelだけ、tick labelだけのON/OFFが仕様どおり動く
- X/Yの設定が相互に漏れない

### 16.4 line width / pattern / color

- curve、axis、grid、guideの`stroke-width`が各styleを反映する
- solidではdasharrayなし
- dashed、dotted、dash-dotが正しいmappingを持つ
- color変更が対象要素だけに反映される

### 16.5 tick visibility / density

- tick label OFFでtextだけが消え、設定どおりtick markは残る
- minor tick OFFでminor要素が存在しない
- X auto nice ticksが通常rangeで概ね4〜7個になる
- Y標準0–14、major interval 2で期待tick列になる
- sampling point数を変えてもtick列が変わらない
- tick labelに`-0`、NaN、Infinityがない
- outside / inside / bothがX/Yおよびminor tickへ正しい座標で反映される
- X/Yの`showZeroLabel`を全組合せで切り替え、0 tick markと非0 labelが残る

### 16.6 grid visibility

- grid ON/OFFがgrid groupの有無へ反映される
- grid OFFでもaxis/tick/curveは変わらない
- Exam presetでgridがない

### 16.7 multiple equivalence guide rendering

- 0件、1件、2件、3件以上の`equivalencePoints`を処理する
- all ONで範囲内の全当量点guideが描画される
- all OFFで描画されない
- ID単位visibilityで対象だけを描画できる内部renderer testを持つ
- 各guideに安定した`data-id`がある
- 先頭以外の当量点周辺も正しいX座標になる
- characteristic pointも配列・ID単位で処理できる

### 16.8 title / labels / annotations

- title、X label、Y label、tick labels、annotationsが独立にON/OFFできる
- Exam presetでtitle、guides、annotationsがない
- Teaching presetでaxis labelsとequivalence guidesがある
- preset適用後の個別変更が上書きされない

### 16.9 background / figure size

- whiteで全体背景rectがある
- transparentで仕様どおり背景がない
- viewBoxと出力寸法がFigure Sizeを反映する
- PreviewのCSS sizeがSVG内部寸法を変更しない
- 任意比率、比率preset、固定ON/OFFがSVG rootのwidth/height/viewBoxへ反映される

### 16.10 typography / 日本語UI

- tick label、axis label、titleのfont sizeがpt単位で個別にSVG textへ反映され、px表記を出力しない
- 1 / 9 / 10.5 / 12 ptのuser unit換算とinvalid値rejectを検証する
- 9 ptから18 ptへの増加時に必要marginが増え、plotまたはSVG外で文字が切れない
- 非finiteまたは0以下のfont sizeをrendererがrejectする
- typographyと縦横比の変更でcurve pointsが変わらず、Calculationを再実行しない
- 主要Controls、preset、図のサイズ、出力操作が日本語で表示される
- 各presetおよび任意font-familyを目盛り数値、軸ラベル、タイトルへ独立して反映できる
- Centuryを目盛り数値、MS Minchoを軸ラベル、MS Gothicをタイトルへ同時指定できる
- 各custom font-familyをXML escapeし、空文字列をrejectする
- axis labelのauto回帰、custom alongAxis 0/0.5/1、offset、Y rotation中心を検証する

## 17. Sampling/data integrity tests

Renderingへ渡す前のcontract testとして、次を必須にする。詳細アルゴリズムは`calculation-spec.md`を正とする。

- duplicate volumeなし
- volumeは厳密なascending order
- 全volume、total volume、h、pHがfinite
- 全当量点がsampling refinement対象になっている
- 端点と全範囲内equivalence anchorが含まれる
- axis tick設定を変えてもsampling結果が変わらない
- 不正点をrendererが黙って除外しない

## 18. Preview/Export consistency tests

- Previewへ渡したSVGとSVG Exportが同じrenderer invocation由来である
- 正規化したSVG構造、path data、主要属性、textが一致する
- style各項目を1つずつ変更したとき、PreviewとExportの双方へ同じ差分が現れる
- 複数当量点の全guideが双方で一致する
- PreviewのCSS scale変更がExport SVGを変えない
- PNG変換へ渡すSVG sourceがSVG Exportと同一内容である
- PNG専用rendererまたは別座標生成経路が存在しないことをmodule境界テストまたはcode reviewで確認する
- 1倍・2倍・4倍の寸法、background mode、PNG MIME、filename、Canvas上限、toBlob null、Object URL cleanupを検証する
- PNG設定変更・PNG Exportでcurve point、Calculation呼出数、SVG renderer呼出数が変化しない
- UI化学式の下付き変換とcanonical formula不変、Examの320×240・4:3・typography・線幅、Y軸ラベルの0°/±90°、単一transform、custom回転中心を検証する
- stale PreviewではPNG Exportを拒否し、多価系SVGも化学分岐なしで変換できる

Canvasのpixel比較はブラウザ・font差の影響を受けるため、MVP自動テストではPNG Blob生成、MIME type、寸法、非空を中心に確認し、代表出力の目視確認を受入れ項目に加える。

## 19. Preset acceptance fixtures

### 19.1 Exam fixture

代表fixture AまたはDを用い、次を確認する。

- white background
- black solid curve
- simple/少数ticks
- no grid
- no title
- no guides
- no annotations
- SVGがモノクロ印刷で判読可能

### 19.2 Teaching fixture

複数当量点を持つDまたはFを用い、次を確認する。

- axis labels visible
- 全equivalence guides visible
- optional grid設定が反映される
- 複数guideとcurveを識別できる
- guide表示が計算点やaxis tick数を変えない

シュウ酸H2C2O4 + NaOH（fixture D）は、複数当量点のUI/Rendering代表ケースとして必ず含める。

## 20. エラー・空状態

- 初期未計算状態は、曲線を捏造せず入力案内を表示する。
- validation errorは該当fieldとsummaryで示す。
- unsupported systemは「計算不能」ではなく「MVP設計上未対応」であることと理由を示す。
- convergence failureは入力値と再現情報を内部diagnosticsに保持し、Exportを無効にする。
- rendererへ不正な数値・空pointsが渡った場合は明示errorを返し、壊れたSVGを生成しない。
- PNG変換失敗はSVG Export成功と区別して表示し、SVGまで無効扱いにしない。

## 21. UI・描画上の禁止事項

- style stateへ物質、濃度、体積、Ka、計算点を格納すること
- style変更で化学計算を変えること
- 高密度sampling点をそのままaxis tickとして使うこと
- pHを0〜14へ書き換えてからrendererへ渡すこと
- PreviewとExportのrenderer、tick generator、scaleを別実装にすること
- PNG独自rendererを作ること
- 単一`equivalencePoint`または先頭indexだけをguide表示すること
- 非finite点を黙ってdropし、前後を線で接続すること
- splineで未計算の極値を作ること
- Exam/Teaching preset適用後の個別変更を禁止すること
- 設計にないannotationや補正線を自動追加すること

## 22. MVP UI/描画完成条件

- 左Controls、右Previewの基本構成で指定カテゴリを操作できる。
- 指定Analyte/Titrant入力を正規化し、成功・入力エラー・未対応・収束失敗を区別できる。
- Curve、X/Y Axis、Ticks、Guides、Figure Sizeを独立設定できる。
- Graph title、axis labels、tick labels、grid、equivalence points等を個別にON/OFFできる内部モデルを持つ。
- Exam presetとTeaching presetが定義どおり適用され、適用後に個別変更できる。
- 標準Y軸0–14、major 2、minor OFF、X auto nice ticks 4〜7個程度を実現する。
- 複数当量点・複数特徴点を配列とIDで描画可能である。
- viewBox、clipPath、path/polyline、line style、text、white/transparent backgroundを備えたSVGを生成する。
- PreviewとSVG Exportが同じrendererを使用し、PNGが同じSVGから生成される。
- 本書の構造・属性・visibility・複数guide・sampling integrity・consistency testsが通る。
