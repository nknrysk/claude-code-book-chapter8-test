# timelog

作業時間ログ記録 REPL ツール。起動しっぱなしにした REPL に `start 3` のような 1 コマンドを打つだけで、
作業実績を記録します。

- **打鍵コストの最小化**: 作業の切り替えついでに 1 コマンド。CLI の起動コストを毎回払わない
- **プロンプトが状態を語る**: 現在のプロジェクト・計測中タスク・経過時間をプロンプト自身に表示する
- **ローカル完結**: ネットワーク通信を行わず、実行時の外部依存を持たない。データは `~/.timelog/` のみ

## 動作環境

- Node.js v24 以上（devcontainer が提供する環境をそのまま使えます）

## インストール

```bash
npm install
npm run build
node dist/index.js
```

`npm link` すると `timelog` コマンドとして起動できます。

## 使い方

```
$ timelog
timelog v0.1.0  ('help' でコマンド一覧)

[未選択] > use myproj
プロジェクトを myproj に切り替えました

[myproj] > task list
   1  認証API実装
   2  レビュー対応
   3  定例MTG

[myproj] > start 1 JWT の検証まわり
計測を開始しました: 認証API実装 (09:12)

[myproj] ▶ 認証API実装 01:05 > stop
計測を終了しました: 認証API実装 09:12-10:17 (65分)

[myproj] > show
2026-08-12 の作業実績

  #  開始   終了   時間        プロジェクト  タスク       備考
  1  09:12  10:17  1:05(65分)  myproj        認証API実装  JWT の検証まわり
  2  10:30  11:00  0:30(30分)  myproj        定例MTG

  タスク別小計
    myproj / 認証API実装  1:05 (65分)
    myproj / 定例MTG      0:30 (30分)

  合計  1:35 (95分)
```

### コマンド一覧（MVP）

| コマンド                    | 説明                                                 |
| --------------------------- | ---------------------------------------------------- |
| `project add <名前>`        | プロジェクトを登録する                               |
| `project list`              | 登録済みプロジェクトを一覧する                       |
| `use <プロジェクト>`        | 作業対象プロジェクトを切り替える                     |
| `task add <名前>`           | 現在のプロジェクト配下にタスクを登録する             |
| `task list`                 | タスクを最近使った順に一覧する                       |
| `start <番号\|名前> [備考]` | 計測を開始する（計測中なら自動的に確定してから開始） |
| `stop`                      | 計測を終了してエントリを確定する                     |
| `resume`                    | 直前に確定したエントリと同じタスクで再開する         |
| `note <テキスト>`           | 計測中のエントリに備考を設定する（上書き）           |
| `show [YYYY-MM-DD]`         | 1日の作業実績とタスク別小計を表示する                |
| `help [コマンド名]`         | コマンド一覧 / コマンドの詳細を表示する              |
| `exit`                      | 終了する（計測中は中止して `stop` を促す）           |

事後入力 `add` / 事後修正 `edit` / アーカイブ `archive` / CSV エクスポート `export` は次の段階で追加します。

## データの保存先

```
~/.timelog/                 # パーミッション 700
├── projects.json           # プロジェクト/タスクのマスタ (600)
├── current.json            # 計測中の状態。存在しない = 計測していない (600)
├── recovery.jsonl          # 復帰処理の発動記録（タイムスタンプのみ）(600)
└── entries/                # (700)
    └── 2026-08.jsonl       # 月別・1行1エントリ
```

`TIMELOG_HOME` を設定すると保存先を変更できます（テストで一時ディレクトリを使う際にも利用します）。

エントリは内部ID（`projectId` / `taskId`）と記録時点の名前スナップショットの両方を持ちます。
表示にはIDから解決した現在の名前を使うため、タスク名を修正すると過去の実績にも遡って反映されます。
マスタを失った場合はスナップショットの名前へフォールバックし、警告を表示します。

## 開発

```bash
npm test           # テスト
npm run test:coverage
npm run lint
npm run typecheck
npm run build
```

設計ドキュメントは `docs/` にあります。

| ファイル                         | 内容                 |
| -------------------------------- | -------------------- |
| `docs/product-requirements.md`   | プロダクト要求定義書 |
| `docs/functional-design.md`      | 機能設計書           |
| `docs/architecture.md`           | 技術仕様書           |
| `docs/repository-structure.md`   | リポジトリ構造定義書 |
| `docs/development-guidelines.md` | 開発ガイドライン     |
| `docs/glossary.md`               | 用語集               |

## このリポジトリについて

本リポジトリは技術評論社より発行されている[「実践Claude Code入門 - 現場で活用するためのAIコーディングの思考法」](https://www.amazon.co.jp/dp/4297153548)のサンプルコードを管理する GitHub リポジトリです。
timelog は、そのスペック駆動開発の題材として実装されたアプリケーションです。

リポジトリ内のコード・プロンプトに関する詳細な解説は、書籍をご覧ください。
書籍の内容に関するご質問、不備のご指摘については以下のリポジトリのイシューよりお願いいたします。

https://github.com/GenerativeAgents/claude-code-book

### 開発環境（Dev Container）

Visual Studio Code で「Reopen in Container」を選択すると、Node.js 環境の構築と `npm install` が自動的に行われます。
Dev Container を利用する際は、事前に Docker のインストールが必要です。
