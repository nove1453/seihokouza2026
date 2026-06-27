# Seiho Study

保険講座の試験対策Webアプリです。問題コンテンツはUIから分離され、科目・年度・フォームを追加できます。

## 起動

```bash
python3 -m http.server 4173
```

ブラウザで `http://localhost:4173` を開きます。

## データ構成

- `data/questions.json`: 問題・選択肢・正解・解説・テキスト根拠
- `data/catalog.json`: 配布する問題パックの一覧
- `question-store.js`: 基礎パックと管理者追加データをIDで統合するデータ層
- `app.js`: 画面、学習モード、履歴・復習ロジック
- `styles.css`: レスポンシブUI

学習履歴はブラウザの `localStorage` に保存され、画面右上のメニューからJSONのエクスポート・インポートができます。

## 管理者モード

一般画面右上の「•••」を開き、「管理者モードを開く」を選択します。次の専用URLから直接開くこともできます。

`http://localhost:4173/admin.html`

管理画面からJSON/CSVの一括登録、問題・解説・引用の編集、新規問題追加、全問題エクスポート、学習履歴を含むバックアップができます。管理者が追加・編集した問題はIndexedDBに保存され、問題IDが同じ場合は内容だけが更新されます。

静的配布する問題パックを追加する場合は、JSONファイルを `data/` に置き、`data/catalog.json` にパスを追加します。アプリ本体の変更は不要です。

インポート形式は `data/import-template.json` と `data/import-template.csv` を参照してください。
