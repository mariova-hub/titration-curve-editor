# titration-curve-editor 正式プロジェクト仕様書

- 文書状態: 実装前の設計契約
- 対象リポジトリ: `titration-curve-editor`
- 対象Phase: MVP設計・実装・受入れ
- 関連文書: [calculation-spec.md](./calculation-spec.md)、[ui-rendering-test-spec.md](./ui-rendering-test-spec.md)

## 1. 文書の目的と優先順位

本書は、`titration-curve-editor` の目的、MVP境界、責務分離、共通データモデル、実装順序および完成条件を固定する正式設計仕様書である。化学計算の詳細は `calculation-spec.md`、UI・描画・Export・描画テストの詳細は `ui-rendering-test-spec.md` を正とする。文書間に解釈差がある場合は、化学的妥当性については計算仕様、見た目と出力についてはUI・描画仕様を優先し、プロジェクト境界については本書を優先する。実装時に矛盾を発見した場合、コード側で独自解釈せず、先に設計文書を改訂する。

## 2. プロジェクト目的

高校化学の試験問題、授業教材、解説資料に使用する滴定曲線を、酸・塩基・濃度・体積などの入力条件から化学平衡に基づいて自動計算し、軸、目盛り、線幅、線種、補助表示などを編集して、貼り付け可能な品質のSVG/PNG図版として生成するローカルWebアプリを作る。

本製品は、見た目を優先する単純な学習用シミュレーターではない。「化学的に正しい理論滴定曲線」と「問題作成に適した編集可能な図版」の両方を成立させることを主目的とする。表示都合によるpH値の補正やクリップは行わない。

## 3. 想定利用者

- 高校化学の教員、講師、教材作成者
- 試験問題、ワークシート、解説資料を作成する編集者
- 理論滴定曲線を検証・利用する大学初年次教育の担当者
- SVGを文書作成ソフトやDTP環境へ取り込みたい利用者

利用者が数値計算アルゴリズムを理解していなくても、物質、濃度、体積を指定すれば妥当な初期値と明確なエラー表示を得られることを前提とする。

## 4. 想定利用シナリオ

1. AnalyteとTitrantの物質、濃度、Analyte初期体積を入力する。
2. アプリが滴下体積範囲、複数の理論当量点、特徴点を求め、全域のpHを計算する。
3. Previewで曲線と図版設定を確認する。
4. ExamまたはTeaching presetを起点に、軸範囲、少数の目盛り、線幅、線種、ガイドなどを調整する。
5. Previewと同じ描画モデルからSVGまたはPNGを出力し、試験問題・教材へ貼り付ける。
6. 設計上未対応の化学系を選択した場合は、推測計算をせず、未対応理由を確認する。

## 5. MVP対象範囲

### 5.1 機能

- 25 ℃、水溶液、活量補正なしの酸塩基滴定
- 単一Analyte溶液へ単一Titrant溶液を加える系
- 酸へ塩基、塩基へ酸の両方向を同一solverで計算
- 物質マスターに登録された強酸、弱酸、強塩基、弱塩基の利用
- 段階解離する多価酸・多価塩基、および1式量あたり複数OH⁻を供給する強塩基を表現可能な汎用モデル
- 複数当量点と複数特徴点を持つ計算結果
- 全当量点周辺を高密度化できるadaptive sampling
- 計算条件と図版スタイルを独立に編集
- SVG Preview、SVG Export、SVG由来のPNG Export
- Exam/Teaching preset
- 化学計算、sampling、SVG構造、Preview/Export一貫性の自動テスト

### 5.2 MVP対象物質

| 区分 | 名称 | 化学式 | モデル上の要点 |
|---|---|---|---|
| 酸 | 塩酸 | HCl | 解離stepを持つ強酸 |
| 酸 | 硝酸 | HNO3 | 解離stepを持つ強酸 |
| 酸 | 硫酸 | H2SO4 | 第1・第2段階を区別可能。単純な「2価強酸」に固定しない |
| 酸 | 酢酸 | CH3COOH | 一段階の弱酸平衡 |
| 酸 | シュウ酸 | H2C2O4 | `H2C2O4 / HC2O4⁻ / C2O4²⁻` の二段階平衡。必須fixture |
| 酸 | 炭酸 | H2CO3 | 二段階平衡 |
| 酸 | リン酸 | H3PO4 | 三段階平衡 |
| 塩基 | 水酸化ナトリウム | NaOH | 1 molあたり1 molのOH⁻を供給 |
| 塩基 | 水酸化カリウム | KOH | 1 molあたり1 molのOH⁻を供給 |
| 塩基 | 水酸化カルシウム | Ca(OH)2 | 1 molあたり2 molのOH⁻を供給 |
| 塩基 | 水酸化バリウム | Ba(OH)2 | 1 molあたり2 molのOH⁻を供給 |
| 塩基 | アンモニア | NH3 | 共役酸NH4⁺を含む弱塩基平衡 |

平衡定数の具体値は曖昧な記憶で埋めない。物質マスターへ値、温度、定義、出典、確認日を登録する運用は `calculation-spec.md` に従う。

## 6. 多価系対応方針

`valence: 2` のような単一整数だけを化学モデルとして扱わない。酸塩基族は、プロトン化状態ごとのspeciesと隣接状態間の段階的dissociation stepで表現する。

- `protonCount`: 酸塩基族が保持・放出可能なプロトン数を表す補助情報
- `species`: 化学式、電荷、プロトン化レベルを持つ各化学種
- `dissociationSteps`: `Ka1`, `Ka2`, ... に相当する段階の順序、種の対応、モデル種別、定数参照
- `mode: "complete" | "equilibrium"`: 各段階を完全解離として扱うか、平衡定数で扱うか
- `hydroxideStoichiometry`: NaOHなら1、Ca(OH)2/Ba(OH)2なら2。強塩基の式量あたりOH⁻供給数

H3PO4、H2C2O4、H2CO3は段階平衡として扱う。H2SO4は第1段階と第2段階を別stepとして表現し、各stepの扱いを独立に定義可能にする。多価弱塩基も同じspecies/step表現を反対向きに利用できる設計とし、一価専用solverや酸専用solverを作らない。

当量点は、供与・受容可能なプロトン当量と段階的中和の化学量論から0個以上を列挙する。段階が数学的に存在しても実用上分離して観測できるとは限らないため、「理論当量点」と「曲線上で分離して見える変曲」を同一視しない。

## 7. 非対象範囲

- バックエンド、DB、クラウド同期、ユーザーアカウント、共同編集
- 反応条件や図版設定のクラウド保存
- PDF直接出力（MVP必須ではない）
- 活量係数、イオン強度補正、温度依存、非水溶媒
- 沈殿、錯生成、酸化還元、気液平衡、揮発、反応速度
- 混酸・混塩基など複数独立酸塩基族の任意混合物入力
- 滴定中の体積非加成性、密度変化
- 逆反応を無視できない完全解離以外の現象を、定数なしに推測すること
- 未登録物質を化学式だけから自動推定すること
- PDF、Word、PowerPointへの直接埋め込み

## 8. 技術構成

- 言語: TypeScript
- UI: HTML/CSS。MVPではReact等のフレームワークを必須としない
- 描画: SVG DOMまたはシリアライズ可能なSVG描画モデル
- Build/dev server: Viteを想定
- Test: Vitestを想定
- Runtime: ローカルブラウザのみ
- PNG: SVGをCanvas等へ変換して生成。独立PNG rendererは禁止

ライブラリ選定は実装Phaseで最小限に行う。依存追加だけで設計上の責務境界を崩してはならない。

## 9. 責務分離

| Layer | 責務 | 入力 | 出力 | 禁止される責務 |
|---|---|---|---|---|
| Domain | 単位付き値、物質、species、平衡step、入力・結果型、検証エラー | マスター・ユーザー値 | 正規化されたドメイン値 | DOM、SVG、UI状態 |
| Chemistry | 酸塩基族、完全解離、平衡定数、保存則へ寄与する化学モデル | 物質と物質量 | solver用chemical system | sampling、座標変換 |
| Calculation | mass/charge balanceとKwから各滴下量の[H⁺]を解く | chemical system、滴下体積 | pH、species濃度、収束情報 | 表示用丸め、pH clip |
| Sampling | 滴下体積列を生成し、全当量点周辺を高密度化する | 計算範囲、特徴点、sampling設定 | 昇順で重複なしの体積列 | pHを補間して真値とみなすこと |
| Rendering | 計算結果とGraphStyleを描画モデルへ写像 | `TitrationResult`, `GraphStyle` | SVG scene/SVG text | 化学再計算、入力条件の変更 |
| Export | 同一描画モデルのSVG保存、SVGからPNG変換 | renderer出力、export設定 | SVG/PNG | 別系統での再描画 |
| UI | 入力、validation表示、preset、preview更新、export操作 | ユーザー操作 | ドメイン入力・スタイル状態 | 化学式の個別分岐、solverロジック |

依存方向は原則として `UI → Domain/Calculation/Sampling/Rendering/Export`、`Rendering → Domain types` とし、CalculationはRendering/UIへ依存しない。PreviewとSVG Exportは同一のrenderer関数と描画モデルを使用する。

## 10. 推奨ディレクトリ構成

以下は実装Phaseで作成する推奨構成であり、本Phaseでは作成しない。

```text
src/
  domain/
    models.ts
    units.ts
    validation.ts
  chemistry/
    substances.ts
    constants.ts
    chemical-system.ts
    species-distribution.ts
  calculation/
    charge-balance.ts
    root-finder.ts
    titration-solver.ts
    equivalence-points.ts
  sampling/
    adaptive-sampling.ts
  rendering/
    graph-model.ts
    svg-renderer.ts
    axes.ts
    curve.ts
    guides.ts
  export/
    svg-export.ts
    png-export.ts
  ui/
    state.ts
    controls.ts
    preview.ts
  styles/
tests/
  unit/
  fixtures/
  regression/
  rendering/
docs/
```

## 11. 共通データモデル

以下は責務と必須性を固定する概念例である。TypeScript実装時の命名やreadonly指定は、意味を変えない範囲で調整できる。単位はフィールド名または専用型で明示し、暗黙変換しない。

### 11.1 Substanceモデル

```ts
type DissociationMode = "complete" | "equilibrium";

interface ChemicalSpecies {
  id: string;
  formula: string;
  charge: number;
  boundProtonCount: number;
}

interface ConstantReference {
  kind: "Ka" | "Kb" | "pKa" | "pKb";
  value: number;
  temperatureC: 25;
  sourceId: string;
}

interface DissociationStep {
  order: number;
  acidSpeciesId: string;
  conjugateBaseSpeciesId: string;
  mode: DissociationMode;
  constant?: ConstantReference;
}

interface Substance {
  id: string;
  displayName: string;
  formula: string;
  roleCapabilities: Array<"acid" | "base">;
  family?: {
    protonCount: number;
    species: ChemicalSpecies[];
    dissociationSteps: DissociationStep[];
  };
  completeIons?: Array<{
    speciesId: string;
    coefficientPerFormulaUnit: number;
    charge: number;
  }>;
  hydroxideStoichiometry?: number;
  provenance: {
    sourceId: string;
    reviewedAt: string;
    notes?: string;
  };
  support: "mvp" | "future" | "unsupported";
}
```

`hydroxideStoichiometry` は強塩基の化学量論を表すが、弱塩基の「価数」代用には使わない。完全解離によって生じる対イオンは電荷収支へ必ず含める。定数はspecies間のstepへ結びつき、配列番号だけに依存させない。

### 11.2 TitrationInputモデル

```ts
interface SolutionComponentInput {
  substanceId: string;
  concentrationMolPerL: number;
}

interface TitrationInput {
  temperatureC: 25;
  analyte: SolutionComponentInput & {
    initialVolumeL: number;
  };
  titrant: SolutionComponentInput;
  titrantVolumeRangeL: {
    min: number;
    max: number;
  };
  sampling: SamplingSettings;
}
```

Analyte/Titrantは容器上の役割であり、acid/baseの向きを意味しない。したがって逆滴定でもフィールドとsolverは同じである。MVPでは各solutionに主成分を1つ指定する。

### 11.3 CurvePointモデル

```ts
interface CurvePoint {
  titrantVolumeL: number;
  totalVolumeL: number;
  hydrogenIonConcentrationMolPerL: number;
  pH: number;
  speciesConcentrationsMolPerL?: Readonly<Record<string, number>>;
  solver: {
    converged: true;
    residual: number;
    iterations: number;
  };
}
```

公開結果に含める数値はすべてfiniteでなければならない。計算失敗を`NaN`点として曲線へ混入させず、結果全体を明示的な失敗型として返す。

### 11.4 EquivalencePointモデル

```ts
interface EquivalencePoint {
  id: string;
  ordinal: number;
  titrantVolumeL: number;
  stoichiometricEquivalent: number;
  participatingStepIds: string[];
  pH?: number;
  classification: "theoretical";
}
```

`pH`はその体積でsolverが正常収束した場合にのみ設定する。当量点を配列indexだけで参照せず、安定した`id`をguide表示に用いる。

### 11.5 特徴点モデル

```ts
interface CharacteristicPoint {
  id: string;
  kind: "half-equivalence" | "initial" | "custom";
  relatedEquivalencePointIds: string[];
  titrantVolumeL: number;
  pH?: number;
  stepId?: string;
}
```

半当量点は複数保持可能とし、`pH = pKa`は適用条件を満たす場合の検証関係であって、pHを代入する計算方法ではない。

### 11.6 TitrationResultモデル

```ts
interface TitrationResult {
  input: TitrationInput;
  points: CurvePoint[];
  equivalencePoints: EquivalencePoint[];
  characteristicPoints: CharacteristicPoint[];
  diagnostics: {
    temperatureC: 25;
    kw: 1.0e-14;
    warnings: string[];
  };
}

type TitrationCalculationOutcome =
  | { ok: true; result: TitrationResult }
  | { ok: false; error: CalculationError };
```

`equivalencePoint`という単数プロパティは禁止し、必ず`equivalencePoints: EquivalencePoint[]`を用いる。特徴点も`characteristicPoints`配列で保持する。`points`は滴下体積の厳密な昇順で重複を持たない。

### 11.7 SamplingSettingsモデル

```ts
interface SamplingSettings {
  basePointCount: number;
  refinementWindows: Array<{
    target: "all-equivalence-points" | "characteristic-points";
    halfWidthFractionOfRange: number;
    pointCount: number;
  }>;
  maxPointCount: number;
  volumeDeduplicationToleranceL: number;
}
```

SamplingSettingsは目盛り数やSVG pixel幅から独立させる。

### 11.8 LineStyleモデル

```ts
type LinePattern = "solid" | "dashed" | "dotted" | "dash-dot";

interface LineStyle {
  visible: boolean;
  widthPx: number;
  pattern: LinePattern;
  color: string;
}
```

### 11.9 AxisStyleモデル

```ts
interface AxisStyle {
  visible: boolean;
  label: string;
  labelVisible: boolean;
  min: number | "auto";
  max: number | "auto";
  majorTickInterval: number | "auto";
  minorTickInterval: number | "off" | "auto";
  tickLabelsVisible: boolean;
  showZeroLabel: boolean;
  line: LineStyle;
  tickLengthPx: number;
  tickWidthPx: number;
  tickDirection: "outside" | "inside" | "both";
  labelPosition: {
    mode: "auto" | "custom";
    alongAxis: number;
    offsetPx: number;
  };
}
```

X/Y軸は独立した`AxisStyle`を持つ。`visible`は軸全体、`labelVisible`は軸ラベル、`tickLabelsVisible`は目盛り数値を制御する。`showZeroLabel`は0の目盛り線を残したまま数値ラベルだけを制御する。`tickDirection`と軸ラベル位置もX/Yで独立する。`alongAxis`は0〜1、`offsetPx`は0以上のfinite値とする。軸範囲は表示上のclip領域であり、計算値を書き換えない。

### 11.10 GraphStyleモデル

```ts
interface GraphStyle {
  presetOrigin?: "exam" | "teaching" | "custom";
  figure: {
    widthPx: number;
    heightPx: number;
    background: "transparent" | "white";
  };
  title: { visible: boolean; text: string };
  typography: {
    tickLabelFontSizePt: number;
    tickLabelFontFamily: string;
    axisLabelFontSizePt: number;
    axisLabelFontFamily: string;
    titleFontSizePt: number;
    titleFontFamily: string;
  };
  curve: LineStyle;
  xAxis: AxisStyle;
  yAxis: AxisStyle;
  grid: { visible: boolean; line: LineStyle };
  guides: {
    allEquivalencePointsVisible: boolean;
    equivalencePointVisibility: Record<string, boolean>;
    characteristicPointVisibility: Record<string, boolean>;
    line: LineStyle;
  };
  annotationsVisible: boolean;
}
```

PresetはGraphStyleの初期値を一括適用する操作であり、モード固定ではない。適用後は各項目を個別変更できる。化学計算条件をGraphStyleへ格納してはならない。

UIの標準表示言語は日本語とし、化学式、pH、SVG、PNG、mol/L、mL等の標準表記はそのまま用いる。図のwidth/heightは自由指定に加え、任意の横比率・縦比率による縦横比固定を提供する。縦横比、目盛り方向、軸ラベル位置、原点ラベル表示、typographyは図版styleであり、変更時に化学計算またはsamplingを再実行しない。目盛り数値、軸ラベル、タイトルのfont sizeはpt単位をfield名に明示し、font familyとともに各系統で独立して保持する。SVG textのfont-sizeはptで出力し、plot geometryでは`1 pt = 96 / 72 = 4 / 3` user unitとして一元換算する。Centuryは英数字を優先し、日本語用fallbackを含むstackとして提供する。SVGへフォントファイルは埋め込まない。

## 12. 複数当量点・特徴点対応

- Calculationは滴定開始前に、対象化学系と体積範囲から理論当量点候補を列挙する。
- Samplingは`equivalencePoints`の全要素をrefinement targetとして使用する。
- Renderingは全表示、ID単位表示、全非表示を扱える描画モデルを持つ。
- MVP UIは「全当量点ON/OFF」だけでもよいが、内部状態を単一boolean/単一volumeに縮退させない。
- 半当量点は各中和段階と対応付け、複数保持する。
- 当量点が表示範囲外の場合も計算結果のメタデータには保持できるが、rendererはclipPathにより描画領域外へ線を出さない。

## 13. Validationと未対応系

入力値は計算前に検証する。濃度、初期体積、最大滴下体積は正のfinite値、最小滴下体積は0以上、範囲は`min < max`とする。物質マスターに必要な定数・species・電荷・stepが欠ける場合や、酸と酸の組合せなどMVPの反応対象にならない場合は、理由を持つ`unsupported-system`または`invalid-input`として返す。

未対応系について、経験式、直線補間、見た目の似た既知曲線への置換、単なる強酸/強塩基換算で処理してはならない。

## 14. GitHub運用方針

- リポジトリ名は正確に`titration-curve-editor`とする。
- 変更は目的別の小さなcommitに分け、設計変更と実装変更を識別可能にする。
- main branchへの統合前に、型検査、unit test、regression test、rendering testを通す。
- 化学定数の変更には、出典・温度・影響fixtureをPR説明または変更記録に明記する。
- 生成SVG/PNGを無条件に大量commitせず、regression fixtureとして必要なものだけ管理する。
- 設計契約を変える実装は、対応する`docs/`更新を先行または同一変更で行う。
- branch、commit、tag、remote運用の細部はチーム方針に従う。本設計作成PhaseではGit操作を行わない。

## 15. 実装Phase

### Phase 0: 設計固定

本3文書をレビューし、定数出典、solver許容誤差、MVPのブラウザ範囲など未決事項を確定する。

### Phase 1: Domainと物質マスター

単位、型、validation、species/stepモデル、出典付き25 ℃定数を実装する。対象物質のマスター検証テストを作る。

### Phase 2: Chemistry/Calculation

汎用chemical system、species distribution、電荷収支、log濃度空間のroot finderを実装する。一価専用の暫定solverは作らない。A〜G fixtureと逆方向をテストする。

### Phase 3: Equivalence/Sampling

複数当量点、特徴点、全当量点周辺のadaptive samplingを実装し、重複なし・昇順・finiteをテストする。

### Phase 4: Rendering

GraphStyle、座標変換、軸、少数目盛り、曲線、複数guideを含む純粋なSVG rendererを実装する。

### Phase 5: UI/Presets/Export

左右レイアウト、入力、preset、Preview、SVG Export、SVG由来PNG Exportを統合する。

### Phase 6: 受入れ・文書化

全自動テスト、代表図版の目視確認、アクセシビリティの基本確認を行う。scaffoldと起動方法が確定した時点でREADMEと`.gitignore`を作成する。

## 16. MVP完成条件

- 指定12物質が出典付き物質マスターに登録され、シュウ酸が必須対象として機能する。
- A〜Gの代表fixtureと、少なくとも設計上の逆滴定方向が汎用solverで処理可能である。
- mass balance、charge balance、平衡式、Kwに基づく数値解で、全curve pointがfiniteかつ収束済みである。
- 多価系を単一valenceへ縮退せず、複数当量点と複数特徴点を保持する。
- sampling点が昇順・重複なしで、全当量点周辺に十分な点を持つ。
- 計算点密度を変えても、軸目盛り設定が変わらない。
- PreviewとSVG Exportが同じrenderer出力を使い、PNGはそのSVGから生成される。
- Exam presetで白背景、黒実線、簡潔な目盛り、グリッドなし、タイトルなし、ガイドなし、注釈なしの図を生成できる。
- SVG構造・表示制御・複数guide・Preview/Export一貫性テストが通る。
- 設計上未対応の系は、理由付きエラーとなり、曲線を捏造しない。

## 17. 禁止事項

- 一価専用solverを先に作り、後で多価solverへ置き換えること
- 酸→塩基用と塩基→酸用のsolverを重複実装すること
- `valence`だけで多価酸・多価塩基を表現すること
- H2SO4を固定的な「2価完全強酸」とだけ定義すること
- Ca(OH)2/Ba(OH)2の式量あたりOH⁻数を無視すること
- 当量点を単一プロパティ`equivalencePoint`で持つこと
- 初期pH、当量点pH、半当量点pHを区分公式の継ぎ合わせだけで曲線へ代入すること
- pH値を見た目のために0〜14などへclip、補正、丸めしてから保存すること
- 計算点の密度を軸目盛り密度へ流用すること
- PreviewとExportに別rendererを実装すること
- PNG専用の独立rendererを実装すること
- `NaN`、`Infinity`、未収束点を曲線へ含めること
- 未対応の化学系を警告なしに近似処理すること
- 設計にない便利機能を実装者の判断だけで追加すること

## 18. 将来拡張方針

MVPの責務境界を維持したうえで、次を候補とする。

- 温度指定と温度依存Kw/平衡定数
- 活量補正、イオン強度
- 複数酸塩基族の混合系
- 両性種、任意の多価弱塩基の物質マスター拡充
- 滴定データのimportと理論曲線比較
- guide/annotationのID単位UI編集
- 図版テンプレート保存、JSON import/export
- PDFまたは文書形式への連携
- 色覚・印刷を考慮した追加preset

将来拡張は、既存のspecies/stepモデル、共通solver、複数特徴点、renderer境界を拡張して行い、MVP実装を置換する別系統のsolverやrendererを増設しない。

## 19. 設計変更管理

実装中に新しい化学系、定数解釈、数値安定性要件、描画要件が必要になった場合は、次の順序を守る。

1. 対象がMVPか将来拡張かを判定する。
2. 化学計算への影響を`calculation-spec.md`へ反映する。
3. UI/出力への影響を`ui-rendering-test-spec.md`へ反映する。
4. 本書のデータモデル、Phase、完成条件を整合させる。
5. fixtureと受入れ条件を更新した後に実装する。

設計文書にない挙動を、テストなしの暗黙仕様として残してはならない。
