# Titration Curve Editor アイコンアセット

正式な英語名は **Titration Curve Editor** です。単語間にハイフンは入れません。

## ファイル構成

```text
assets/
├─ app-icon.svg          # 編集・再生成用の原版
└─ favicon-small.svg     # 小サイズ向け簡略版の原版

public/
├─ app-icon-512.png      # 512 × 512 px
├─ apple-touch-icon.png  # 180 × 180 px
├─ favicon-32x32.png     # 32 × 32 pxの簡略版
├─ favicon-16x16.png     # 16 × 16 pxの簡略版
└─ favicon.ico           # 16 / 32 / 48 pxフレーム
```

`assets/` は編集・再生成用の原版を保持します。`public/` はViteの静的アセットとして、そのまま配信およびproduction buildへコピーされます。

## HTMLからの参照

`index.html` では次の参照を使用します。

```html
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
```

Viteアプリをドメインルート以外のサブパスへ配置する場合は、Viteの`base`設定と参照パスを合わせます。

## 図柄と配色

- 512 px版とApple Touch版は、白背景、pH/V軸、紺色のS字曲線、青・緑・赤の点、ビュレット、三角フラスコからなる正式図柄です。
- 16 px版と32 px版は、小さなfaviconでも判別できるよう、軸、曲線、3色の点だけを残した簡略図柄です。
- 基調色は紺 `#17365f`、点の色は青 `#2474d2`、緑 `#27a66b`、赤 `#e44848` です。

SVG原版またはPNG配信物を更新するときは、同じ図柄・配色と各出力寸法を維持し、小サイズ版の視認性を16 pxおよび32 pxで確認します。
