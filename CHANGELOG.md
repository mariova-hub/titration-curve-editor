# Changelog

## [1.1.0] - 2026-08-25

### Added

- 炭酸ナトリウム（Na₂CO₃）と炭酸水素ナトリウム（NaHCO₃）を追加し、対応物質を14物質へ拡張
- Na₂CO₃をHClで滴定する二段滴定曲線と、第一・第二当量点の表示
- NaHCO₃をHClまたはNaOHで滴定する両方向の滴定曲線
- 物質選択UIの「塩・両性種」グループ
- 複数当量点の補助線をLive Preview、SVG、PNGへ出力する機能

### Changed

- Adaptive Samplingが複数の当量点を一般的に処理し、各当量点近傍を高密度化
- 炭酸塩の組成、spectator ion、炭酸family平衡を共通の物質収支・電荷収支計算へ統合

### Notes

- 炭酸系はCO₂散逸を考慮しない閉鎖系モデルです。
- 複数の分析物質を混合した水溶液の滴定には対応していません。

## [1.0.0] - 2026-08-20

### Added

- 酸・塩基・モル濃度・体積から理論滴定曲線を自動生成する機能
- 酸へ塩基を滴下する場合と、塩基へ酸を滴下する場合の両方向への対応
- 多価酸・多価塩基、段階的な電離平衡、複数当量点への対応
- 酸7物質（HCl、HNO₃、H₂SO₄、CH₃COOH、H₂C₂O₄、H₂CO₃、H₃PO₄）と塩基5物質（NaOH、KOH、Ca(OH)₂、Ba(OH)₂、NH₃）
- 25 ℃における物質収支・電荷収支・酸塩基平衡に基づくpH数値計算
- すべての当量点近傍を高密度化するAdaptive Sampling
- SVGによるLive PreviewとSVG Export
- SVGを変換元とするPNG Export、および1倍・2倍・4倍の出力倍率
- Word等へ貼り付ける小型図版向けの試験問題プリセット
- グリッド、当量点、特徴点を表示する教材プリセット
- 曲線、軸、主目盛り・補助目盛り、グリッド、補助線、マーカーの表示・style調整
- 軸ラベルの位置調整と、Y軸ラベルの横書き・左90°・右90°切り替え
- 任意の図のサイズ、縦横比、縦横比固定
- 目盛り数値・軸ラベル・タイトルを独立設定できるpt単位のTypography
- Century、MS Gothic、MS PGothic、MS Mincho、MS PMincho等のfont-family選択
- UIにおける化学式数字の下付き表示
- GitHub Pages project siteへの配布構成
- PWAとしてのインストールと、Service Workerによるオフライン利用
- favicon、Apple Touch Icon、PWA用app icon
- MIT License

### Notes

- SVGを描画のsingle source of truthとし、Preview、SVG Export、PNG Exportで同じ描画仕様を使用します。
- SVGへフォントファイル自体は埋め込みません。指定フォントが利用環境にない場合はfallback fontで表示されます。
- 一部のKa / Kbには、高校化学の試験問題・教材との整合を優先した高校教材用定数セットを採用しています。
- 計算温度は25 ℃固定で、活量補正は行いません。
