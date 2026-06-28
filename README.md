# Seiho Study

生命保険講座の試験対策Webアプリです。問題コンテンツと学習履歴を分離しています。

## 起動

```bash
python3 dev-server.py
```

- 学習画面: `http://127.0.0.1:4173/`
- 管理画面: `http://127.0.0.1:4173/admin.html`

## データ構成

問題データの正本は次の2種類です。

- `data/catalog.json`: 読み込む科目・年度・フォーム・JSONパスの一覧
- `data/questions/{subjectSlug}/{year}/{form}.json`: 問題・解説・引用
- `data/textbooks/{textbookId}.pdf`: 回答根拠として画面内表示するテキストPDF

学習履歴、正答率、復習状態、ブックマーク、画面の選択状態だけをブラウザの `localStorage` に保存します。問題本文はlocalStorageやIndexedDBへ保存しません。

現在の科目slug:

- 生命保険総論: `seiho-souron`
- 生命保険経理: `seiho-keiri`
- 危険選択: `kiken-sentaku`
- 生命保険計理: `seiho-keiri-math`
- 約款と法律: `yakkan-houritsu`

## 管理画面

`dev-server.py`で起動したローカル開発環境では、「dataへ直接保存」で問題JSONとcatalogをプロジェクトへ保存できます。

静的Webアプリはブラウザからローカル/GitHub上のファイルへ直接書き込めないため、公開環境では次の手順に切り替わります。

1. JSON/CSVをインポート、または問題を追加・編集・削除する
2. 厳格バリデーションを通す
3. 「出力ファイルを準備」を押す
4. ZIP内の `data` フォルダをプロジェクトへ上書き配置する

ZIPには各問題セットと、自動更新された `data/catalog.json` が含まれます。既存問題のIDは編集できないため、配置後も学習履歴との紐付けが保たれます。

## JSONセット形式

```json
{
  "version": 1,
  "subject": "生命保険総論",
  "subjectSlug": "seiho-souron",
  "year": 2024,
  "form": "B",
  "updatedAt": "2026-06-28T00:00:00.000Z",
  "questions": []
}
```

アプリは起動時に `data/catalog.json` を読み込み、そこに記載された全JSONを取得します。科目・年度・フォームはコードへハードコーディングしていません。

`catalog.json`の各科目には、次のテキスト情報を設定できます。

```json
{
  "textbook": {
    "textbookId": "seiho-souron-2026",
    "title": "2026年版 生命保険講座 生命保険総論",
    "pdfPath": "data/textbooks/seiho-souron-2026.pdf"
  }
}
```

問題の`evidence`では、印字ページを`page`、PDF実ページを`pdfPage`へ指定します。`pdfPath`が問題側にない場合はcatalogの科目設定を使います。PDF情報がない既存JSONも従来どおり引用文だけで利用できます。

登録済みテキストPDF:

- 生命保険総論: `data/textbooks/seiho-souron-2026.pdf`
- 生命保険計理: `data/textbooks/seiho-keiri-math-2026.pdf`

登録済み問題:

- 生命保険総論: 2022〜2024年 Form A〜C、450問
- 生命保険計理: 2022〜2024年 Form A〜C、450問

生命保険計理の印字ページとPDF実ページの基本差は+8です（例: テキストP6は`pdfPage: 14`）。元JSONで根拠ページが「要確認」の問題は、PDFページ未登録として保存しています。
