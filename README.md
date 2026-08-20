# titration-curve-editor

高校化学の試験問題・授業教材・解説資料向けに、理論滴定曲線を編集可能なSVG/PNG図版として生成するローカルWebアプリです。

## 現在のPhase

現在はPhase 1です。Project Scaffold、Domain Model、初期Substance Masterの構造、基本Validation、テスト基盤までを実装しています。

現時点の画面は開発基盤の動作確認用であり、滴定曲線を操作する完成UIではありません。

## 技術構成

- TypeScript（strict mode）
- HTML / CSS
- Vite
- Vitest
- SVGを主出力とする設計（rendererは未実装）

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

## Phase 1で実装済み

- 多段階のprotonation speciesとdissociation stepを表すDomain Model
- `complete`と`equilibrium`を区別する解離step
- 未確認Kaを数値なしの`pending`状態で保持する構造
- Ca(OH)2 / Ba(OH)2の式量あたりOH⁻数を保持する構造
- 12物質を登録した初期Substance Master構造
- 複数当量点・複数特徴点を保持する結果モデル
- Graph Style Model
- 滴定入力の基本Validation

## 現在未実装の機能

- pH計算engine
- 物質収支・電荷収支
- root finding
- 当量点・半当量点の計算
- adaptive sampling
- SVG rendererとPreview
- PNG/SVG Export
- 滴定条件・図版styleを編集するUI本体
- 正式なKa/Kb値と出典

これらは設計文書に定めた後続Phaseで実装します。
