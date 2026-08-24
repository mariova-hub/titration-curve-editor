# titration-curve-editor 酸塩基平衡・滴定曲線計算仕様書

- 文書状態: 実装前の正式計算契約
- 対象: Chemistry / Calculation / Equivalence / Sampling
- 関連文書: [project-specification.md](./project-specification.md)、[ui-rendering-test-spec.md](./ui-rendering-test-spec.md)、[v1.1-salt-titration-design.md](./v1.1-salt-titration-design.md)

## 1. 目的

本書は、一価・多価、強酸・弱酸、強塩基・弱塩基、および滴定方向を同じ考え方で処理する酸塩基平衡計算仕様を定める。一価系の区分公式をつないだ専用solverは採用しない。各滴下体積について、物質収支、電荷収支、段階的酸塩基平衡、水のイオン積から水素イオン濃度`[H⁺]`を数値的に求める。

本書でいう「理論当量点」は化学量論上の中和段階であり、曲線上で目視できる変曲点と必ずしも一致しない。計算値、表示範囲、表示丸めは互いに独立させる。

## 2. MVPの計算前提

- 温度: 25 ℃固定
- 水のイオン積: `Kw = [H⁺][OH⁻] = 1.0e-14 (mol/L)²`
- pH定義: `pH = -log10([H⁺] / (1 mol/L))`。実装上、`[H⁺]`の数値をmol/Lで持つため`-log10(h)`と計算する
- 活量: 活量係数を1とし、濃度で近似する
- 溶媒: 水
- 体積: 加成的
- 温度・圧力・密度変化: 考慮しない
- 対象平衡: 登録済み酸塩基平衡と水の自己解離
- 対象外平衡: 沈殿、錯生成、酸化還元、気液平衡、揮発、反応速度

25 ℃以外を入力として受け入れてはならない。将来温度対応する場合はKwと全平衡定数を同じ温度へ揃える。

## 3. 内部単位と数値規約

| 量 | 内部単位 | 規約 |
|---|---|---|
| 物質量 | mol | finite、0以上 |
| 濃度 | mol/L | 入力は正、計算種濃度は0以上 |
| 体積 | L | UIのmLは境界でLへ変換 |
| 温度 | ℃ | MVPは型・validationとも25固定 |
| 平衡定数 | 濃度標準状態に基づく数値 | マスターで定義種と出典を明示 |
| pH | 無次元表示値 | 内部では丸めない |

`number`へ単位の異なる値を混在させない。UIの文字列解釈、mL↔L変換、表示桁丸めはDomain/UI境界で一度だけ行う。計算途中、保存結果、sampling判定に表示用丸めを使わない。

入力、定数、中間値、最終値に`NaN`または`Infinity`を許容しない。underflow/overflowが起こり得る累乗は、log空間またはスケーリングした式で評価する。

## 4. 物質マスターと定数管理

### 4.1 必須メタデータ

各物質・各平衡stepは、次を保持する。

- 安定した物質ID、species ID、step ID
- 表示名、化学式、species電荷、結合プロトン数
- stepの反応式と順序
- `complete`または`equilibrium`の扱い
- `equilibrium`の場合はKaまたはpKa等の値、定義、25 ℃であること
- 元資料の名称、版・URLまたは書誌情報、参照箇所、確認日
- 値の変換履歴（例: pKaからKaへ変換）
- レビュー状態

### 4.2 定数値を確定する手順

本設計文書では曖昧な記憶に基づく具体的Ka/Kbを決め打ちしない。実装Phase 1で、信頼できる一次資料、標準的データ集、公的・大学等の検証可能な資料から25 ℃の値を確認し、出典付きfixtureとして固定する。複数資料で値や定義が異なる場合、採用理由と回帰テストへの影響を記録する。

Kbしか得られない場合に共役酸Kaへ変換するときは、同じ25 ℃の`Kw`を用いて`Ka = Kw / Kb`とし、原値と変換式を記録する。濃度定数・熱力学定数など定義の異なる値を無記録で混在させない。

### 4.3 マスター整合性検証

- species電荷は整数で、stepごとに酸speciesの電荷と共役塩基speciesの電荷が1だけ異なる。
- `equilibrium` stepには正のfiniteな定数がある。
- `complete` stepを有限Kaで代用しない。
- 一般に段階Kaの順序が期待と逆転している場合は警告または要レビューとする。ただし自動で並べ替えない。
- `hydroxideStoichiometry`は正の整数で、完全解離ionの係数・電荷と整合する。
- H2C2O4には`H2C2O4`、`HC2O4⁻`、`C2O4²⁻`と2つの段階平衡が必須である。
- H2SO4の第1・第2段階は別stepであり、個別のmodeと定数参照を持つ。

## 5. 入力の正規化と物質量計算

Analyte/Titrantは酸塩基種別ではなく、初期容器側と滴下側の役割である。

初期Analyte物質量:

```text
n_analyte = C_analyte × V_analyte_initial
```

滴下体積`v`におけるTitrant物質量:

```text
n_titrant(v) = C_titrant × v
```

全液量:

```text
V_total(v) = V_analyte_initial + v
```

各保存族または固定ionの分析濃度は、由来する全物質量を`V_total`で割って求める。同一speciesが複数入力成分から生じ得る将来拡張では、物質量を合算してから希釈する。

```text
C_total,family(v) = n_total,family(v) / V_total(v)
C_fixed-ion(v)    = n_fixed-ion(v) / V_total(v)
```

化学量論係数は式量あたりで適用する。例としてCa(OH)2およびBa(OH)2は、1 molの物質から2 molのOH⁻に対応する電荷当量を与える。実装では単に入力濃度を2倍したNaOHへ名前だけ置換せず、Ca²⁺/Ba²⁺の固定ionと係数・電荷をchemical systemへ含める。

## 6. Chemical systemへのコンパイル

物質マスターと物質量を、各滴下体積で次の構成へ変換する。

1. 水由来の`H⁺`と`OH⁻`
2. 濃度が化学量論で決まる固定ion（Na⁺、K⁺、Ca²⁺、Ba²⁺、Cl⁻、NO3⁻など）
3. 総濃度がmass balanceで保存され、プロトン化状態が平衡で分配される酸塩基族

完全解離は無限大Kaとして数値計算しない。`complete` stepはchemical system構築時に、解離後speciesまたは固定ionへ化学量論的に変換する。

- HClのように残る酸塩基平衡がない強酸は、Cl⁻等の固定陰ionを入れる。電気的中性条件から対応するH⁺が解に現れる。
- NaOH/KOHはNa⁺/K⁺を固定陽ionとして入れる。電気的中性条件とKwからOH⁻が解に現れる。
- Ca(OH)2/Ba(OH)2はCa²⁺/Ba²⁺を式量濃度で入れる。その+2電荷が1 molあたり2 molのOH⁻供給と整合する。
- H2SO4で第1段階を`complete`、第2段階を`equilibrium`とする場合、保存族の基準speciesをHSO4⁻とし、`HSO4⁻ ⇄ H⁺ + SO4²⁻`を有限Kaで扱う。第2段階まで完全解離と決め打ちしない。

対ionの省略は電荷収支を破壊するため禁止する。

## 7. 酸塩基族とconjugate species

### 7.1 汎用段階平衡

ある酸塩基族について、最もプロトン化された平衡対象speciesを`H_NA^(z0)`とし、j個脱プロトン化したspeciesを`S_j`とする。

```text
S_(j-1) ⇄ H⁺ + S_j        Ka_j
```

電荷はstepごとに1減少する。

```text
charge(S_j) = z0 - j
```

一般のspecies表に記録された電荷を正とし、上式は整合性検証に用いる。これにより、H3PO4/H2PO4⁻/HPO4²⁻/PO4³⁻、H2C2O4/HC2O4⁻/C2O4²⁻、NH4⁺/NH3などを同じ族として扱える。

### 7.2 species distribution

`h = [H⁺]`、平衡対象step数を`N`とする。分布係数の未正規化重みを次で定義する。

```text
β_0(h) = 1
β_j(h) = (Ka_1 × Ka_2 × ... × Ka_j) / h^j
α_j(h) = β_j(h) / Σ(k=0..N) β_k(h)
[S_j]  = C_family × α_j(h)
```

実装は`log(β_j)`を用いたlog-sum-exp等で正規化し、極端なpHでのoverflow/underflowを避ける。全`α_j`はfinite、0以上、総和が指定許容誤差内で1でなければならない。

### 7.3 弱酸・弱塩基・多価弱塩基

- 弱酸は、酸speciesから共役塩基speciesへのKa stepとして表す。
- 弱塩基NH3は、共役酸NH4⁺の酸解離`NH4⁺ ⇄ H⁺ + NH3`として同じ分布式へ入れる。塩基専用Kb solverは作らない。
- 将来の多価弱塩基も、最もプロトン化されたspeciesからの段階Ka群へ正規化し、同じmass/charge balanceへ入れる。
- 酸側入力か塩基側入力かにかかわらず、保存族の総物質量は同じmass balanceを満たす。

## 8. 保存則と電荷収支

### 8.1 mass balance

各保存族`f`について:

```text
C_f = Σ_j [S_f,j]
```

species distributionを用いる場合、`Σ_j α_f,j = 1`により満たす。固定ionは生成元物質量と化学量論係数から直接濃度を求める。物質収支残差はテスト可能なdiagnosticsとして計算できるようにする。

### 8.2 水の平衡

```text
[OH⁻] = Kw / [H⁺] = Kw / h
```

`h > 0`を常に保証するため、root変数をlog空間に置く。

### 8.3 charge balance

全陽電荷と全陰電荷の差を残差`R(h)`とする。

```text
R(h) = h - Kw/h
     + Σ_i (z_fixed,i × C_fixed,i)
     + Σ_f Σ_j (z_f,j × C_f × α_f,j(h))
```

求める解は:

```text
R(h) = 0
```

すべての固定ion、酸塩基species、水由来ionを含める。電荷0のspeciesもmass balanceには含める。浮動小数点の桁落ちを考慮し、収束判定には代表濃度でscaleした残差も併用する。

## 9. [H⁺]の数値解法

### 9.1 root変数

推奨root変数は`x = log10(h)`であり、`h = 10^x`、`pH = -x`とする。pHを直接root変数にしても数学的に同値だが、実装内で符号規約を混在させない。

```text
F(x) = R(10^x)
```

### 9.2 決定的なbracket

初期bracketは次とする。

```text
x_low  = -16  // h = 1e-16 mol/L, pH 16
x_high =   2  // h = 1e2 mol/L,  pH -2
```

端点は`x_low < x_high`で管理する。`F(x_low)`と`F(x_high)`が異符号またはいずれかが0であることを確認する。符号変化がなければ、2 decadeずつ決定的に外側へ拡張し、hard limit `[-30, 6]`（pH 30〜-6相当）まで探索する。hard limitは表示clipではなく、数値探索の安全境界である。限界まで符号変化がなければ、入力・chemical system・定数・数値評価の異常として失敗させる。

端点で非finite値が出た場合は即失敗とし、0へ置換しない。

### 9.3 bisection

bracket後はbisectionを標準手法とする。Newton法を必須経路にしない。性能最適化で別手法を追加する場合も、bracketを維持し、同じ収束判定を満たし、bisectionへfallback可能にする。

標準設定:

| 項目 | 値 |
|---|---|
| pH/log幅 tolerance | `1.0e-10` |
| 絶対電荷残差 tolerance | `1.0e-12 mol/L` |
| 相対電荷残差 tolerance | `1.0e-10 × concentrationScale` |
| 最大iteration | 256 |

`concentrationScale = max(1.0e-12 mol/L, h, Kw/h, Σ|z_i|C_i)`を基準とし、許容残差は`max(1.0e-12 mol/L, 1.0e-10 × concentrationScale)`とする。成功には、bracketのpH幅が幅tolerance以下であり、かつ最終候補の絶対残差が許容残差以下であることを要求する。端点が厳密に0の場合はその点を解とする。

### 9.4 収束失敗

次を`CalculationError`として返す。

- bracket不能
- 最大iteration超過
- 非finiteな定数、残差、species分布、`h`、pH
- 負のspecies濃度（許容丸め誤差を超えるもの）
- mass balanceまたはcharge balanceの事後検証失敗
- 未対応のchemical system

失敗時は当該点を`NaN`として残して曲線生成を継続しない。体積、物質ID、error code、iteration、bracket、残差など、再現に必要なdiagnosticsを持つ失敗結果を返す。UIは利用者向けメッセージへ変換する。

## 10. 初期pH・当量点pH・半当量点

### 10.1 初期pH

滴下体積`v = 0`を通常の計算点として同じsolverで解く。強酸なら`pH = -log C`、弱酸なら近似式、弱塩基ならKb近似式という別経路を作らない。既知の解析式・近似式はテスト期待値やsanity checkにのみ使う。

### 10.2 当量点pH

各`EquivalencePoint.titrantVolumeL`でchemical systemを構築し、同じroot solverでpHを求める。当量点専用の中性固定、加水分解近似、両性種近似を結果生成経路に使わない。強酸・強塩基の25 ℃当量点が理想的にpH 7付近になることは回帰検証であり、値の強制ではない。

### 10.3 半当量点・特徴点

各段階の前後の理論当量体積の中間など、化学量論で定義できる体積を`CharacteristicPoint`として複数列挙する。その体積で同じsolverを実行する。適用条件を満たす単純弱酸系で`pH ≈ pKa`となることはテスト関係に使えるが、`pKa`をpHへ直接代入しない。

## 11. 理論当量点の列挙

### 11.1 原則

物質マスターのstepと、Analyte/Titrantが供与・受容できる化学量論的プロトン当量から、中和進行上の累積イベントを作る。各イベントについて必要なTitrant物質量を求め、正のTitrant濃度で体積へ変換する。

```text
V_eq,k = n_titrant_required,k / C_titrant
```

当量点候補は体積昇順、重複なしとし、`ordinal`、関連step ID、化学量論当量を保持する。要求された滴下体積範囲外の点を計算メタデータへ保持するかは実装方針として統一するが、sampling対象は範囲内の点だけとする。

### 11.2 多価系

- H2C2O4 + NaOHでは二段階の累積中和イベントを表現できる。
- H3PO4 + NaOHでは三段階の累積中和イベントを表現できる。
- H2SO4 + NaOHではstepごとのmodeにかかわらず、定義されたプロトン供与段階を区別する。
- Ca(OH)2 + HClではCa(OH)2 1 molあたり2 molのH⁺当量を必要とする。

段階定数が近い、濃度が低い、範囲外である等の理由で複数イベントが曲線上で明瞭に分離しない場合も、理論イベントと可視変曲を混同しない。rendererが当量点guideを表示するときは「理論当量点」を表示する。

### 11.3 滴定方向の共通化

酸へ塩基を滴下する場合と、塩基へ酸を滴下する場合でsolverを分けない。両solutionを同じchemical systemへコンパイルし、違いは`v`に応じて各保存族・固定ionの物質量が変わることだけで表す。当量イベント列挙も、供与体/受容体とstepをデータとして解釈し、化学式別・方向別のハードコードを避ける。

## 12. 曲線sampling

### 12.1 設計原則

- samplingはCalculationとRenderingの間の独立責務とする。
- 計算点密度と軸のmajor/minor tick密度を完全に分離する。
- `points`は`titrantVolumeL`の厳密な昇順で、重複を持たない。
- 各採用体積でsolverを実行する。補間値を理論計算値として保存しない。
- 0、指定範囲端、全当量点、全特徴点を必要に応じてexact anchorとして含める。

### 12.2 adaptive sampling

最低限、次の2段階で候補体積を作る。

1. 全範囲を覆うbase sampling
2. 範囲内の**すべての**`equivalencePoints`を中心とする局所refinement、および必要に応じた`characteristicPoints`周辺refinement

各windowは全範囲にclipし、候補を合成後、体積toleranceでdeduplicateして昇順sortする。単一当量点しか高密度化しない実装は禁止する。局所幅・点数は`SamplingSettings`に置き、AxisStyleから参照しない。

追加の曲率ベースrefinementを行う場合は、隣接計算点のpH変化または幾何誤差を評価して再帰的に中点を**再計算**する。最大点数、最大深さ、最小体積間隔を設定して停止性を保証する。急変部でも当量体積をexact anchorとして失わない。

### 12.3 duplicate排除

exact anchorを優先し、近接候補を体積toleranceで統合する。統合時に平均体積へずらして当量点を失わず、当量点・端点・特徴点の優先順位を定義する。最終配列に同一体積が2回現れず、全差分が正であることをテストする。

### 12.4 interpolationの制限

SVGのpath/polylineが隣接する計算点を線分で結ぶことは表示上許可する。ただし、次は禁止する。

- pHを線形補間して新しい`CurvePoint`またはmarker値として保存すること
- sparse samplingを曲線平滑化だけで隠すこと
- splineが計算点の範囲をovershootして、未計算のpH極値を作ること
- 当量点pH、半当量点pH、annotation値を描画pathから逆算すること

MVPの既定curveは計算点を通るpolylineまたは直線segmentのSVG pathとする。将来平滑化を追加する場合もopt-inの表示機能とし、元データと区別する。

## 13. 計算結果の事後条件

成功した各`CurvePoint`は次を満たす。

- `titrantVolumeL >= 0`かつfinite
- `totalVolumeL = initialVolumeL + titrantVolumeL`が許容誤差内で成立
- `hydrogenIonConcentrationMolPerL > 0`かつfinite
- `pH = -log10(h)`が内部精度で成立
- 全species濃度がfiniteかつ0以上
- 各familyのmass balanceが許容誤差内
- charge balance残差がsolver許容値内
- solverが収束済みでiteration上限以内

成功した`TitrationResult.points`は1点以上、体積昇順、重複なしである。`equivalencePoints`と`characteristicPoints`は0個以上の配列であり、単数へ縮退しない。

## 14. 必須unit tests

### 14.1 Domain/マスター

- 指定12物質が存在する
- シュウ酸H2C2O4の3 species、2 equilibrium steps、電荷が正しい
- H3PO4の4 species、3 steps、H2SO4の分離stepが正しい
- Ca(OH)2/Ba(OH)2のOH⁻化学量論数が2で、固定陽ion電荷と整合する
- 定数に25 ℃と出典がある
- 不正なcharge、欠落step、非finite定数を拒否する

### 14.2 species distribution

- 各`α_j`がfinite、0以上、総和1
- 低pH側で高プロトン化species、高pH側で低プロトン化speciesが優勢になる
- stepの`[H⁺][base]/[acid] = Ka`が許容誤差内
- 極端なbracket端でもoverflow/underflowで非finiteにならない
- NH4⁺/NH3を同じKa分布で扱える

### 14.3 root finder

- 既知の連続単調関数で決定的に同じ解・iterationを返す
- endpoint root、初期bracket成功、bracket拡張成功を扱う
- bracket不能、非finite評価、iteration超過を明示的に失敗させる
- 最終幅・残差がtolerance内

### 14.4 chemical system

- 物質量、全液量、希釈が正しい
- 固定ionを含む電荷収支が正しい
- v=0、当量点、過剰滴下側を同じsolverで処理する
- 酸/塩基の配置を逆にしても、別solverを呼ばない

### 14.5 equivalence/sampling

- 0/1/複数当量点を列挙できる
- H2C2O4とH3PO4の全理論当量点を保持できる
- 全当量点周辺にbase領域より高密度な点がある
- 端点・当量点anchorが正確に含まれる
- 体積が昇順、重複なし、全点finite
- point上限と停止条件を守る
- tick設定を変えてもsampling結果が変わらない

## 15. 代表regression fixtures

定数依存の期待pHは、Phase 1で正式定数と出典を固定した後に高精度の期待値・許容差を記録する。現段階で曖昧な数値を記載しない。各fixtureは少なくとも初期、各当量点、各半当量点、当量点前後、十分な過剰滴下域を含む。期待値の作成には、独立した信頼できる参照計算または検証可能な高精度計算を用い、本実装の出力をそのままgolden valueにしない。

| ID | Analyte | Titrant | 必須検証 |
|---|---|---|---|
| A | 0.100 mol/L HCl, 20.0 mL | 0.100 mol/L NaOH | 20.0 mLの理論当量体積、25 ℃理想系の当量点pH、前後対称性のsanity check |
| B | 0.100 mol/L CH3COOH, 20.0 mL | 0.100 mol/L NaOH | 弱酸初期域、buffer域、半当量関係、当量点の塩基性、過剰OH⁻域 |
| C | 0.100 mol/L NH3, 20.0 mL | 0.100 mol/L HCl | 弱塩基初期域、buffer域、半当量関係、当量点の酸性、過剰H⁺域 |
| D | 出典確定済み濃度のH2C2O4 | NaOH | 2段階species分布、2つの理論当量イベント、全イベント周辺sampling、各段階のmass/charge balance |
| E | 出典確定済み濃度のH2SO4 | NaOH | 第1/第2stepの区別、第2解離平衡、2当量分の化学量論、単純2価完全解離への縮退がないこと |
| F | 出典確定済み濃度のH3PO4 | NaOH | 4 species、3段階平衡、3つの理論当量イベント、全イベント周辺sampling |
| G | 出典確定済み濃度のCa(OH)2 | HCl | 1 molあたり2 molのOH⁻当量、Ca²⁺電荷収支、対応する理論当量体積 |

D〜Gの濃度、初期体積、Titrant濃度、滴下範囲は、複数段階を検証可能にする値をPhase 1でfixture metadataへ固定する。Dのシュウ酸は省略不可の代表fixtureである。

### 15.1 逆滴定方向

A〜Gの各組合せについてAnalyte/Titrantを入れ替え、適切な初期体積・滴下範囲を与えたケースを、少なくとも設計・統合テストで処理可能にする。逆方向で期待される当量イベントの数や可視性が正方向と同じとは限らないが、次は共通でなければならない。

- 同一のchemical-system compiler、species distribution、charge-balance、root-finderを使用する
- 物質量と固定ionの由来だけが役割に応じて変わる
- 全点finite、mass/charge balance成立、体積昇順・重複なし
- 未対応になる場合は方向別solverへ逃げず、データモデルまたはMVP境界の不足を明示する

## 16. property tests / invariant tests

乱数生成範囲はMVP validation範囲と正式定数に限定し、再現可能なseedを記録する。

- 任意の正の濃度・体積で全液量が正かつ物質量保存
- 任意の有効hで各族の分率総和が1、濃度が非負・finite
- solver成功時にcharge balance残差が許容値内
- 滴下体積候補が範囲内、昇順、重複なし
- sampling point数が上限以下
- 強酸/強塩基の十分な過剰域で、過剰当量とsolver結果が既知の限界挙動に近づく
- 同一入力・設定で結果が決定的
- GraphStyleやtick設定を変更しても化学計算結果が不変
- 物質のAnalyte/Titrant上の役割を入れ替えても、共通solverの不変条件を満たす

pHが滴下全域で必ず単調というpropertyは、任意の多価系・選択条件では一般則として採用せず、適用可能なfixtureに限定する。

## 17. regression fixtureの保存形式

fixtureは少なくとも次を含む機械可読データとする。

- fixture ID、目的、作成日
- 物質マスターversionまたは定数source ID
- 入力値と内部単位
- 期待当量点・特徴点の体積
- 代表体積と期待pH/species濃度
- 値ごとの絶対・相対許容差
- 参照計算方法・出典
- solver/sampling設定

SVG snapshotは化学fixtureの正解値にしない。化学結果fixtureと描画fixtureを分離する。

## 18. 計算精度と表示精度の分離

- solverのh、pH、species濃度、体積は内部精度のまま保持する。
- tick label、tooltip、annotation、export textの小数桁はRendering/UIのformatterが決める。
- Y軸が標準0〜14でも、計算pHが範囲外ならデータは保持する。rendererのclipPathで表示領域だけを切る。
- 表示上同じ文字列になる近接点も、計算点としては独立に保持できる。
- 表示丸めした体積をsolver入力、deduplication、当量点判定に戻さない。

## 19. 性能と決定性

MVPでは正しさと再現性を優先する。root finder、candidate volume生成、deduplication順序は決定的にする。同じ物質マスター、入力、sampling設定から同じ点数・体積・pH・diagnosticsを得る。

UI応答性のために計算をdebounceまたはworker化することは将来可能だが、計算アルゴリズムや結果を変えてはならない。cacheを導入する場合、keyに入力、物質マスターversion、solver設定、sampling設定を含め、GraphStyleは含めない。

## 20. 計算仕様上の禁止事項

- 一価専用、化学式専用、滴定方向専用のsolverを本計算経路に置くこと
- Henderson–Hasselbalch式などの近似式を曲線の区間生成に使うこと
- 完全解離を極端に大きい有限Kaで模擬すること
- 多価物質を`valence`単独で処理すること
- 対ionを電荷収支から省略すること
- 当量点を1件だけ返すことを型で前提にすること
- 非収束をNaN、直前値、補間値、0/14へのclipで隠すこと
- 表示桁を計算許容誤差に使うこと
- 1つ目の当量点だけをsampling refinementすること
- 正式出典未確認の定数をproduction masterまたはregression期待値へ入れること

## 21. v1.1 composition compilerと塩滴定

v1.1の追加計算契約は`v1.1-salt-titration-design.md`を正とする。既存計算式・定数・solver toleranceを変更せず、次を一般化する。

- Substance 1 molから生成される初期family componentとfixed ion componentを明示し、両solutionを同じcompilerへ渡す。
- family totalは投入時のspeciesにかかわらずmass balanceで保存し、既存species distributionで全プロトン化状態へ分配する。
- Na2CO3はcarbonate family 1 mol（初期`CO3^2-`）とNa+ 2 mol、NaHCO3はcarbonate family 1 mol（初期`HCO3-`）とNa+ 1 molを与える。
- 当量イベントは「最もプロトン化されたspeciesからのacid proton count」ではなく、initial speciesから滴定方向へたどる隣接stepの累積当量として列挙する。
- pairing directionは手入力roleではなくcompositionから導出するproton-transfer capabilityで一意に解決し、曖昧系は推測せずunsupportedとする。
- Fixture Hは10.0/20.0 mLの2当量点と5.0/15.0 mLの特徴点、Fixture I/Jは10.0 mLの当量点と5.0 mLの特徴点を持つ。
- 全当量点・特徴点のpHを通常solverで求め、Fixture Hの両当量点周辺をadaptive samplingする。
- carbonate totalを気相へ減少させず、CO2/H2CO3*を閉鎖系として扱う。

v1.1追加tests、migration不変条件、当量step順序、実装Phaseは専用設計書のSections 12〜24に従う。
