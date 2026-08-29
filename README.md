<p align="center">
  <img src="public/app-icon-512.png" alt="Titration Curve Editor icon" width="128">
</p>

# 滴定曲線エディタ

英語正式名：**Titration Curve Editor**

高校化学の試験問題・授業教材向けに、酸・塩基・濃度・体積から理論滴定曲線を計算し、軸・目盛り・文字などを整えてSVG / PNG図版として出力できるWebアプリです。編集中の条件と図版設定は`.tcurve`プロジェクトファイルとして保存し、後から開いて編集を再開できます。単なる学習用シミュレーターではなく、問題・教材作成にそのまま使える図版の生成を主目的としています。

現在の正式リリースは v1.3.0 です。

## すぐ使う

https://mariova-hub.github.io/titration-curve-editor/

公開後はURLを開くだけで利用でき、Node.js、npm、Git clone、buildは不要です。

- **Windows**：Chrome、Edge等のブラウザから利用できます。対応ブラウザでは、OS・ブラウザの標準機能を使ってアプリとしてインストールできます。
- **Mac**：Safari、Chrome等のブラウザから利用できます。対応環境ではDockへの追加またはPWAとしてのインストールが可能です。

一度オンラインで正常に読み込むと、PWA / Service Workerによってアプリ本体が保存され、オフラインでも滴定条件の変更、pH計算、曲線の再生成、SVG生成、PNG生成を利用できます。初回読み込みと更新取得にはネットワーク接続が必要です。インストール操作の名称や配置はブラウザ・OSによって異なります。

## 主な機能

### 滴定曲線の自動計算

- 酸・塩基、モル濃度、滴定される水溶液の体積を指定
- 酸へ塩基を滴下する場合と、塩基へ酸を滴下する場合の両方向に対応
- 多価酸、多価塩基、段階的な電離平衡に対応
- 複数の当量点・半当量点を計算
- すべての当量点近傍を高密度化するAdaptive Sampling
- 炭酸ナトリウムを塩酸で滴定する二段滴定に対応し、第一・第二当量点を2本の補助線として表示
- 炭酸水素ナトリウムは、塩酸による酸滴定と水酸化ナトリウムによる塩基滴定の両方に対応

### 混合分析溶液滴定

- 通常の1成分滴定は従来どおり使用可能
- 必要な場合だけ「分析物質を追加」から2成分目を表示し、各成分の物質と濃度を入力
- 2成分で1つの共通体積を使用し、2成分目は削除可能
- 炭酸ナトリウムと水酸化ナトリウムの混合水溶液を塩酸で滴定するケースに正式対応
- 2つの当量点を計算し、両当量点周辺のAdaptive Samplingと2本の当量点補助線をPreview、SVG、PNGへ反映

混合分析溶液滴定は任意の組み合わせに対応するものではありません。UI上の分析物質は最大2成分、滴定液は単一成分で、初期混合時に実質的な中和を必要とせず、現在の反応段階モデルで一意に扱える組み合わせが対象です。

### 試験問題・教材向け図版調整

- 曲線の線幅・線種・色
- X/Y軸の表示範囲、線幅、線種、色
- 主目盛り・補助目盛り、目盛り間隔、目盛り方向（外向き・内向き・両方向）
- X/Y軸ごとの原点`0`表示
- 水平・垂直グリッド
- 複数の当量点・特徴点の補助線とマーカー
- 軸ラベルの位置、軸からの距離、Y軸ラベルの横書き・左90°・右90°
- 自由な図のサイズ、縦横比、白・透明背景

### Typography

- 文字サイズをWord等と同じpt単位で指定可能
- 目盛り数値、軸ラベル、タイトルのサイズとfont-familyをそれぞれ独立設定
- Century、MS Gothic、MS PGothic、MS Mincho、MS PMincho、ゴシック体、明朝体、sans-serif、serif、任意のfont-familyを選択可能

SVGにはフォントファイル自体を埋め込みません。指定フォントが別のPCにない場合は、font-family stackまたは閲覧環境の代替フォントへfallbackします。Centuryには日本語用の明朝系fallbackを設定しており、英数字ではCenturyが優先されます。

### プロジェクト保存・再読込

- 「プロジェクトを保存」から、編集中の状態を`.tcurve`ファイルとして保存
- 「プロジェクトを開く」から、保存した`.tcurve`を読み込んで編集を再開
- 通常の1成分滴定と、最大2成分のmixed analyte滴定の両方に対応
- 分析物質、濃度、体積、mixed analyte composition、滴定液、グラフ・描画設定を復元
- 壊れたファイル、不正な内容、現在のアプリより新しい未対応形式は安全に拒否してメッセージを表示

`.tcurve`は後から開いて再編集するための**編集可能なプロジェクトファイル**です。完成した図を利用するためのSVG / PNGとは用途が異なります。計算済みの曲線そのものは保存せず、読み込み時に保存された滴定条件から曲線を再計算します。

### SVG / PNG出力

- 拡大しても劣化しないSVG
- PNGは1倍・2倍・4倍に対応し、既定値は2倍
- SVG設定を使用・白・透明の背景を選択可能
- PreviewとSVG Exportで同じSVG文字列を使用
- PNGもそのSVG文字列をrasterizeするため、SVG / PNGで描画仕様が分岐しない

## プリセット

プリセット適用後も、各設定を個別に変更できます。

### 試験問題プリセット

Microsoft Word等へ貼り付ける小型図版を想定しています。

| 項目 | 設定 |
| --- | --- |
| 図のサイズ | 320 × 240 px（4:3） |
| 背景 | 白 |
| 曲線 | 黒・実線・2 px |
| 軸 | 黒・実線・2 px |
| 目盛り線幅 | 1.5 px |
| 目盛り数値 | 10.5 pt |
| 軸ラベル | 10.5 pt |
| タイトル | 13.5 pt、初期状態は非表示 |
| グリッド・補助目盛り | 非表示 |
| 当量点・特徴点の補助線／マーカー | 非表示 |
| PNG倍率 | 2倍を推奨 |

### 教材プリセット

授業での説明や大きめの教材図版を想定しています。

| 項目 | 設定 |
| --- | --- |
| 図のサイズ | 720 × 480 px |
| 目盛り数値・軸ラベル・タイトル | 10 pt・11 pt・14 pt |
| 水平・垂直グリッド | 表示 |
| 当量点・特徴点の補助線 | 表示 |
| 当量点・特徴点のマーカー | 表示 |
| X/Y軸ラベル | 表示 |

## 対応している物質

### 酸

- 塩酸 HCl
- 硝酸 HNO₃
- 硫酸 H₂SO₄
- 酢酸 CH₃COOH
- シュウ酸 H₂C₂O₄
- 炭酸 H₂CO₃
- リン酸 H₃PO₄

### 塩基

- 水酸化ナトリウム NaOH
- 水酸化カリウム KOH
- 水酸化カルシウム Ca(OH)₂
- 水酸化バリウム Ba(OH)₂
- アンモニア NH₃

### 塩・両性種

- 炭酸ナトリウム Na₂CO₃
- 炭酸水素ナトリウム NaHCO₃

酸・塩基・塩・両性種を合わせて14物質に対応しています。

READMEとUIでは読みやすさのため数字を下付き表示しますが、物質マスターのcanonical formulaはASCII表記を維持しています。

## 化学計算の特徴

- 温度は25 ℃固定
- `Kw = 1.0 × 10^-14`
- 活量補正なし
- 多価酸の多段階電離平衡を考慮
- 物質収支、電荷収支、酸塩基平衡、KwからpHを数値計算
- 一価専用の近似式ではなく、共通の平衡計算モデルを使用
- 当量点近傍はAdaptive Samplingによって高密度に計算
- 炭酸系は炭酸成分の総量を水相内に保存し、CO₂散逸を考慮しない閉鎖系モデル

計算モデル、数値解法、適用範囲の詳細は[酸塩基平衡・計算仕様](./docs/calculation-spec.md)を参照してください。

### 高校教材用定数

試験問題・教材との整合を優先し、一部のKa / Kbには「化学便覧 基礎編 改訂6版を基礎とする高校化学教材用定数セット」を採用しています。これは各採用値が同便覧へ直接そのまま掲載されていると断定するものではありません。具体値・出典・注記は設計文書および物質マスターのsource metadataで管理しています。

## 利用例

1. 滴定される水溶液を選ぶ。
2. モル濃度と体積を入力する。
3. 混合分析溶液を扱う場合は「分析物質を追加」から2成分目の物質と濃度を入力する。
4. 滴下する水溶液とモル濃度を入力する。
5. 自動生成された滴定曲線を確認する。
6. 軸、目盛り、線、フォント、図のサイズを調整する。
7. 後で編集を続ける場合は、`.tcurve`プロジェクトを保存する。
8. 完成した図をSVGまたはPNGで書き出す。
9. Word等の問題・教材へ貼り付ける。

## Wordとの親和性

- フォントサイズをWordと同じポイント感覚で指定できます。
- 目盛り数値にはCentury等を選び、軸ラベルやタイトルには別のフォントを指定できます。
- 試験問題プリセットはWord貼り付け向けの320 × 240 pxです。
- SVG全体をWord上で拡大・縮小すると、文字も図全体とともに拡大・縮小されます。

## アプリとして利用

GitHub Pages版は通常のWebアプリとして利用でき、対応ブラウザではPWAとしてインストールできます。独自のインストールボタンは設けていないため、ブラウザまたはOSの標準機能を使用してください。一度読み込んだ主要assetはService Workerへprecacheされ、オフラインでもブラウザ内の計算・描画、`.tcurve`プロジェクトの保存・再読込、SVG / PNG生成を利用できます。

## v1.3.0で現在対応していない範囲

- PDFの直接出力
- ユーザー定義物質の登録
- 3成分以上の分析物質を入力するUI、複数成分の滴定液、stock solutionの混合操作
- 初期混合時に実質的な中和反応が必要な組み合わせ、または複数の酸塩基familyの反応段階を一意に扱えない組み合わせ
- 沈殿、錯形成、気体発生を伴う滴定
- CO₂の気相への散逸、開放系の炭酸平衡、Henry則、気相、発泡・速度論的効果
- SVGへのフォント埋め込み
- グラフのzoom / pan
- spline / Bezier補間
- LocalStorage等を使ったブラウザ内への自動保存

これらはv1.3.0の対応範囲には含まれていません。炭酸系は引き続き、CO₂散逸を考慮せず炭酸成分を水相内に保存する閉鎖系モデルです。

## 開発

以下は開発・検証を行う場合だけ必要です。公開版の一般利用者にはNode.js / npmは不要です。

### Requirements

- Node.js `^20.19.0 || >=22.12.0`

Node.js 20系を使用する場合は20.19.0以上、またはNode.js 22.12.0以上を使用してください。

### Commands

```sh
npm install
npm run dev
npm run typecheck
npm test
npm run build
npm run preview
```

| Command | 用途 |
| --- | --- |
| `npm install` | 依存関係をインストール |
| `npm run dev` | 開発サーバーを起動 |
| `npm run typecheck` | TypeScriptの型検査 |
| `npm test` | Vitestの自動テスト |
| `npm run build` | production buildとPWA成果物検証 |
| `npm run preview` | production buildをローカルで確認 |

GitHub Pages用のbase pathは`/titration-curve-editor/`です。開発・preview時はViteが表示する、このbase path付きのURLを使用してください。development modeではService Workerを無効にしているため、PWA / offline動作はproduction buildとpreviewで確認します。

### 技術構成

- TypeScript（strict mode）
- HTML / CSS
- Vite
- Vitest
- SVG
- vite-plugin-pwa

## GitHub Pages公開設定（repository owner向け）

1. GitHub repositoryの **Settings** を開く。
2. **Pages** を開く。
3. **Build and deployment** の **Source** を **GitHub Actions** にする。
4. `main`へpushするか、Actions画面からdeploy workflowを手動実行する。
5. 公開後、GitHub Pagesの正式URLをREADMEの「すぐ使う」へ記載する。

既存workflowはtypecheck・test・buildを行い、`dist/`をGitHub Pagesへdeployします。

## 設計文書

- [プロジェクト仕様](./docs/project-specification.md)
- [酸塩基平衡・計算仕様](./docs/calculation-spec.md)
- [UI・描画・テスト仕様](./docs/ui-rendering-test-spec.md)
- [v1.2 mixed-analyte滴定設計](./docs/v1.2-mixed-analyte-titration-design.md)
- [v1.3.0 Release Notes](./docs/v1.3.0-release-notes.md)
- [v1.2.0 Release Notes](./docs/v1.2.0-release-notes.md)
- [v1.1.0 Release Notes](./docs/v1.1.0-release-notes.md)
- [アイコンアセット](./docs/icon-assets.md)

## ライセンス

本プロジェクトは[MIT License](./LICENSE)のもとで公開されています。
