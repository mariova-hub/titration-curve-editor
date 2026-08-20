# titration-curve-editor

高校化学の試験問題・授業教材・解説資料向けに、理論滴定曲線を編集可能なSVG/PNG図版として生成するローカルWebアプリです。

## 現在のPhase

現在はPhase 5です。化学的に計算した滴定曲線をブラウザで編集・Previewし、同じSVG文字列をファイルとして保存できる実用最小構成まで実装しています。

## 技術構成

- TypeScript（strict mode）
- HTML / CSS
- Vite
- Vitest
- SVGをsingle source of truthとする描画・Preview・Export

React、Vue、Svelte等のUIフレームワーク、バックエンド、DB、クラウドサービスは使用していません。

## セットアップ

Node.jsとnpmを用意し、リポジトリ直下で実行します。

```sh
npm install
```

## Development server

```sh
npm run dev
```

表示されたローカルURLをブラウザで開きます。

## Test

```sh
npm test
```

watch mode:

```sh
npm run test:watch
```

型検査のみ:

```sh
npm run typecheck
```

## Build

```sh
npm run build
```

成果物は`dist/`へ生成されます。

## 設計文書

- [プロジェクト仕様](./docs/project-specification.md)
- [酸塩基平衡・計算仕様](./docs/calculation-spec.md)
- [UI・描画・テスト仕様](./docs/ui-rendering-test-spec.md)

## Phase 5までに実装済み

- 多段階のprotonation speciesとdissociation stepを表すDomain Model
- `complete`と`equilibrium`を区別する解離step
- 『化学便覧 基礎編 改訂6版』を基礎とする高校教材用Ka/Kb（25 ℃）と出典・注記を保持する物質マスター
- Ca(OH)2 / Ba(OH)2の式量あたりOH⁻数を保持する構造
- 12物質を登録した初期Substance Master構造
- 複数当量点・複数特徴点を保持する結果モデル
- Graph Style Model
- 滴定入力の基本Validation
- 任意段数のprotonation species distribution
- 物質収支・固定イオンを含む電荷収支
- pH空間相当の`log10([H+])`における決定的bisection solver
- 任意の滴下体積を解く`calculatePHAtVolume`
- 複数の化学量論当量点と半当量点の計算
- HCl、CH3COOH、NH3、H2C2O4、H2SO4、H3PO4、Ca(OH)2を含む回帰fixture
- 酸→塩基・塩基→酸を同一solverで扱う逆滴定テスト
- 最終当量点後の過剰滴下域を含める自動最大滴下体積
- 通常領域のbase samplingと全当量点近傍の局所高密度sampling
- 0 mL、範囲末端、全範囲内当量点・半当量点のexact anchor
- 浮動小数点近接値を含むsampling volumeの重複除去と昇順保証
- `calculateTitrationCurve`による完全な`TitrationResult` / `CurvePoint[]`生成
- `renderTitrationSvg(result, style)`によるpureなSVG文字列生成
- straight-segment curve pathとplot area `clipPath`
- X/Y独立axis、major/minor ticks、nice X ticks、tick formatter
- horizontal/vertical gridの独立表示
- 複数equivalence/characteristic guidesとcircle markers
- white/transparent background、title/axis label、XML escaping
- Default / Exam / Teaching GraphStyle factory・pure preset
- Desktop向けControls / Previewの2カラムBrowser UIと狭幅時の1カラム表示
- Substance Masterから生成するAnalyte / Titrant選択と濃度・体積入力
- raw入力、validated input、計算結果、GraphStyle、SVG文字列を分離したUI state
- 入力validation、計算失敗のユーザー向け表示と、入力途中の直前Preview維持
- 滴定条件変更時だけのcurve再計算と、style変更時のrenderer-only更新
- Exam / Teaching preset controlsと、適用後の個別style編集
- curve、X/Y axes、range、major/minor ticks、grid、guide/marker、figure size、title/label controls
- `renderTitrationSvg()`の出力を直接DOMへ表示するLive SVG Preview
- Previewと同一のSVG文字列を`image/svg+xml;charset=utf-8`のBlobとして保存するSVG Export

定数値は試験問題・教材との整合を優先します。酢酸`Ka = 2.69e-5`、アンモニア`Kb = 2.3e-5`、シュウ酸`Ka1 = 9.12e-2`、`Ka2 = 1.51e-4`を高校教材用プロファイルとして採用し、NH4+のKaは同じ25 ℃のKwから導出しています。

## 現在未実装の機能

- PNG Export
- Canvas / PDF出力
- user presetや入力条件の永続化

PNG Exportは次Phaseの対象です。Phase 5ではCanvasを使用せず、SVG PreviewとSVG Exportだけを実装しています。
