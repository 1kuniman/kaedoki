# カエドキ

家電の本体型番から、合う交換部品（部品番号・メーカー直販価格・交換めやす）を引けるサイト。
現在の収録：ダイニチ加湿器 255機種／部品7点、シャープ加湿空気清浄機 21機種／部品19点、パナソニック加湿空気清浄機 75機種／部品9点（2026-10-19 確認）。

## 構成

- `data/*.json` … 部品ごとの適用機種リスト（メーカー直販サイトから転記。出典URL付き）
- `site.config.json` … サイト名・URL・AmazonトラッキングID・問い合わせURL
- `build.mjs` … 依存パッケージなしの静的サイト生成。`node build.mjs` で `dist/` に全ページを出力
- `src/` … CSS と JS（検索・候補表示・費用計算）

## 公開手順

1. ドメイン取得後、`site.config.json` の `siteUrl` を本番URLに変更
2. GitHub に push → Vercel で Import（`vercel.json` があるので設定不要）
3. Search Console に登録して `/sitemap.xml` を送信
4. Amazonアソシエイトに登録し、トラッキングID（例：`xxxxx-22`）を `amazonTag` に入れて再デプロイ
5. Googleフォーム等でお問い合わせフォームを作り、URLを `contactUrl` に入れる

## データ更新

部品を追加するときは `data/` のJSONに1件足して `node build.mjs`。
機種ページ・部品ページ・サイトマップ・検索インデックスは自動で再生成される。
価格改定があったら `price` と `checkedAt` を更新する。

## データファイルの形式

1ファイル＝1メーカー×1カテゴリ。主なキー：
- `maker` … 表示名・型番の注意書きなど
- `series` … 形名の正規表現とシリーズ名（一覧ページの見出しになる）
- `primaryKinds` … この種類の部品を持つ機種だけページを作る
- `modelSources` … 機種ごとの出典URL（取扱説明書PDFなど）
- `parts[].models` … その部品が使える形名の一覧（ここから機種ページを逆引き生成）
