# リポジトリ構造定義書 (Repository Structure Document)

作成日: 2026-08-12
対象: `docs/architecture.md` で定義したレイヤードアーキテクチャの物理配置

## プロジェクト構造

```
claude-code-book-chapter8-test/
├── src/                        # ソースコード
│   ├── index.ts                # エントリポイント(shebang / 依存の組み立て / 起動)
│   ├── repl/                   # REPL レイヤー
│   ├── services/               # サービスレイヤー(副作用あり・永続化を伴う)
│   ├── domain/                 # 純粋なビジネスロジック(副作用なし)
│   ├── stores/                 # データレイヤー
│   ├── formatters/             # 表示整形
│   ├── validators/             # 入力検証
│   └── types/                  # 型定義
├── tests/                      # テストコード
│   ├── unit/                   # ユニットテスト
│   ├── integration/            # 統合テスト
│   ├── e2e/                    # E2Eテスト
│   └── helpers/                # テスト補助(一時ディレクトリ / 入出力スクリプト)
├── docs/                       # 永続ドキュメント
│   └── ideas/                  # 壁打ちメモ
├── .steering/                  # 作業単位のドキュメント(git 管理外)
├── .claude/                    # Claude Code 設定(skills / agents / commands)
├── .devcontainer/              # 開発環境定義
├── .husky/                     # Git フック
├── dist/                       # ビルド成果物(git 管理外)
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── eslint.config.js
├── .prettierrc / .prettierignore
├── CLAUDE.md                   # プロジェクトメモリ
├── README.md
└── LICENSE
```

**`config/` と `scripts/` は作成しない**。設定値は `src/stores/paths.ts` と
`src/types/constants.ts` に閉じており、ビルドは `package.json` の `scripts` で完結するため、
空に近いディレクトリを増やす理由がない。必要が生じた時点で追加する。

## ディレクトリ詳細

### src/index.ts (エントリポイント)

**役割**: 依存の組み立て（手動 DI）と `ReplSession` の起動のみを行う

```typescript
#!/usr/bin/env node
// 具象クラスを生成して結線し、run() を呼ぶだけ。ロジックを持たない。
```

**設計上の要点**: DI コンテナは導入しない。依存の数が十数個であり、
コンストラクタ引数として明示的に渡す方が、依存の全体像が 1 ファイルで読める。
`index.ts` が唯一「すべての層を import してよい」場所である。

### src/repl/ (REPL レイヤー)

**役割**: 入力の受付・パース・ルーティング、表示、終了と復帰のフロー制御

**配置ファイル**:

```
src/repl/
├── ReplSession.ts           # 起動シーケンス・入力ループ・終了フロー
├── ReplIo.ts                # 入出力の抽象(interface)と readline 実装
├── PromptRenderer.ts        # 状態表示プロンプトの組み立て
├── CommandRouter.ts         # 入力行のパースとハンドラへのディスパッチ
├── OutputFormatter.ts       # 成功・警告・エラーメッセージの整形
├── recoverTimer.ts          # 起動時の復帰フロー(終了時刻の対話入力)
└── handlers/                # コマンドごとの入出力
    ├── projectHandler.ts    # project add / list / archive
    ├── taskHandler.ts       # task add / list / archive
    ├── useHandler.ts        # use
    ├── timerHandler.ts      # start / stop / resume / note
    ├── showHandler.ts       # show
    ├── addHandler.ts        # add       (P1)
    ├── editHandler.ts       # edit      (P1)
    ├── exportHandler.ts     # export    (P1)
    └── helpHandler.ts       # help
```

**命名規則**:

- クラスを提供するファイルは PascalCase（`ReplSession.ts`）
- 関数を提供するファイルは camelCase（`recoverTimer.ts`、`handlers/*.ts`）
- ハンドラは `[コマンド名]Handler.ts`。サブコマンドを持つものは 1 ファイルにまとめる

**依存関係**:

- 依存可能: `services/`、`formatters/`、`validators/`、`types/`
- 依存禁止: `stores/`、`domain/`

`domain/` への直接依存も禁止する。ハンドラが日跨ぎ分割や集計を直接呼べてしまうと、
「サービスを通さない経路」が生まれ、永続化を伴う処理の入口が二重になるため。

**ハンドラの責務境界**: ハンドラは「引数の検証 → サービス呼び出し → 結果の整形」のみを行う。
条件分岐によるビジネスルールの実装（どのタスクが選ばれるか、何分になるか）を持たない。

### src/services/ (サービスレイヤー)

**役割**: 永続化を伴うビジネス処理の調整。`domain/` の純粋関数と `stores/` を組み合わせる

**配置ファイル**:

```
src/services/
├── ProjectService.ts        # マスタ管理・ID採番・タスク解決・lastUsedAt 更新
├── TimerService.ts          # start / stop / resume / note・日跨ぎ分割の適用
├── ReportService.ts         # 日次集計
├── ExportService.ts         # CSV 生成 (P1)
└── NameResolver.ts          # ID → 現在名の解決とスナップショットへのフォールバック
```

**命名規則**: PascalCase + `Service` / `Resolver` 接尾辞。クラスとして実装する

**依存関係**:

- 依存可能: `domain/`、`stores/`、`types/`
- 依存禁止: `repl/`、`formatters/`

**サービス間の依存**（一方向を維持する）:

```
TimerService ──▶ ProjectService ──▶ ProjectStore
     │                  ▲
     ▼                  │
EntryStore        NameResolver ──▶ ReportService / ExportService が利用
CurrentStore
```

`TimerService → ProjectService` は許可する（`start` 成功時の `lastUsedAt` 更新のため）。
**逆向き（`ProjectService → TimerService`）は禁止**する。

この制約が具体的に効くのが `task archive` である。「計測中のタスクはアーカイブできない」
という仕様を `ProjectService.archiveTask` の中で実装すると、計測状態を知るために
`TimerService` を参照することになり循環する。**この判定は `taskHandler.ts` で行う**
（`TimerService.getCurrent()` で計測中タスクを取得 → 一致したらエラー → 一致しなければ
`ProjectService.archiveTask` を呼ぶ）。サービス間の循環を、呼び出し順序の制御を
上位レイヤーに持ち上げることで回避する。

### src/domain/ (純粋なビジネスロジック)

**役割**: 副作用を持たない計算。ファイル I/O、現在時刻の取得、コンソール出力を一切行わない

**配置ファイル**:

```
src/domain/
├── splitByDay.ts            # 日付境界での分割
├── buildEntries.ts          # 計測区間 → Entry[] の生成(分切り捨て + 分割)
├── truncateToMinute.ts      # 分単位への切り捨て
├── resolveTask.ts           # 番号 / 名前部分一致によるタスク解決
├── byRecency.ts             # 「最近使った順」の比較関数
├── generateId.ts            # Crockford Base32 の ID 採番
├── summarize.ts             # 日次集計(行番号付与・タスク別小計)
└── toCsv.ts                 # CSV 文字列の生成とエスケープ (P1)
```

**命名規則**: camelCase の動詞始まり。1 ファイル 1 エクスポート関数を原則とする

**依存関係**:

- 依存可能: `types/` のみ
- 依存禁止: **それ以外のすべて**（`node:fs`、`node:crypto` 以外の Node 標準モジュールも含む）

**`services/` と分けている理由**: 本プロダクトで最も壊れやすいのは日跨ぎ分割と
タスク解決であり、いずれも入力と出力が決まれば正しさが定義できる純粋な計算である。
これを I/O を持つサービスから物理的に分離することで、**テストがファイルシステムも
時刻モックも必要としない**状態を構造的に保証する。

`generateId.ts` のみ `node:crypto` の `randomBytes` を使うが、乱数源は引数で
差し替え可能にし、テストでは決定的な値を注入する。

### src/stores/ (データレイヤー)

**役割**: ファイルの読み書き、パーミッション付与、破損行のスキップ、原子的な置換

**配置ファイル**:

```
src/stores/
├── ProjectStore.ts          # projects.json の読み書き
├── EntryStore.ts            # entries/YYYY-MM.jsonl の読み書き・追記
├── CurrentStore.ts          # current.json の読み書き・削除
├── atomicWrite.ts           # 一時ファイル + rename による原子的書き込み
└── paths.ts                 # ~/.timelog 配下のパス解決(TIMELOG_HOME に対応)
```

**命名規則**: PascalCase + `Store` 接尾辞（クラス）、camelCase（関数）

**依存関係**:

- 依存可能: `types/`、Node 標準モジュール（`node:fs`、`node:path`、`node:os`）
- 依存禁止: `repl/`、`services/`、`domain/`、`formatters/`、`validators/`

**業務ルールを持たない**: 日跨ぎ分割、集計、並び替え、名前解決を行わない。
`EntryStore.append(entries)` は「渡されたエントリを月ごとに振り分けて追記する」だけであり、
なぜ複数件になっているか（日跨ぎ分割の結果か）を知らない。

**`paths.ts` の役割**: データディレクトリの位置を決める唯一の場所。
`TIMELOG_HOME` 環境変数があればそれを、なければ `os.homedir()/.timelog` を返す。
テストが一時ディレクトリを使えるのはこの 1 ファイルのおかげであり、
他のどこにもパスをハードコードしない。

### src/formatters/ (表示整形)

**役割**: 値を人間が読む文字列に変換する。表示にのみ責任を持つ

**配置ファイル**:

```
src/formatters/
├── formatIsoLocal.ts        # Date → ローカルオフセット付き ISO 8601
├── formatDate.ts            # Date → "YYYY-MM-DD"
├── formatDuration.ts        # 分 → "1:05(65分)" / "00:23"
├── displayWidth.ts          # East Asian Width を考慮した表示桁数の算出
├── renderTable.ts           # 列幅を揃えた表の生成
└── ansi.ts                  # 色付け(非 TTY では素通し)
```

**依存関係**:

- 依存可能: `types/`
- 依存禁止: `repl/`、`services/`、`stores/`、`domain/`

**`domain/` ではなく独立させた理由**: これらも純粋関数だが、
`domain/` は「業務ルール」、`formatters/` は「見せ方」であり、変更の理由が異なる。
表示形式の変更が業務ロジックのテストを壊さない状態を保つ。

`formatIsoLocal.ts` は表示用ではなく**永続化フォーマット**の生成にも使われるため、
`domain/buildEntries.ts` から参照される。これは `formatters/` が
`types/` にしか依存しない純粋関数群であるため、依存の向きとして問題ない。

### src/validators/ (入力検証)

**役割**: ユーザー入力の形式検証と正規化。検証結果を `Result` で返す

**配置ファイル**:

```
src/validators/
├── validateName.ts          # プロジェクト名 / タスク名(1-100文字・制御文字の排除)
├── parseTimeInput.ts        # "HH:MM" / "YYYY-MM-DD HH:MM" のパース
└── parseDateInput.ts        # "YYYY-MM-DD" / "YYYY-MM" のパース
```

**依存関係**:

- 依存可能: `types/`
- 依存禁止: それ以外

### src/types/ (型定義)

**役割**: レイヤーを跨いで共有される型と定数

**配置ファイル**:

```
src/types/
├── entities.ts              # Project / Task / Entry / CurrentTimer / ProjectsFile
├── ids.ts                   # ProjectId / TaskId / DateString / IsoDateTime / MonthKey
├── result.ts                # Result<T, E> と ok() / err() ヘルパ
├── errors.ts                # AppError の判別可能ユニオン
└── constants.ts             # 名前の最大長、ID の文字集合、CSV ヘッダ等
```

**命名規則**: kebab-case または camelCase の複数形。`.d.ts` は使わず `.ts` で実装を伴う型を書く

**依存関係**:

- 依存可能: **なし**（他のどのディレクトリにも依存しない）
- 依存禁止: すべて

このディレクトリが依存を持たないことが、循環依存が発生しないことの根拠になる。

### tests/ (テストディレクトリ)

```
tests/
├── unit/                          # src/ と同じ構造を保つ
│   ├── domain/
│   │   ├── splitByDay.test.ts
│   │   ├── buildEntries.test.ts
│   │   ├── resolveTask.test.ts
│   │   ├── byRecency.test.ts
│   │   ├── generateId.test.ts
│   │   ├── summarize.test.ts
│   │   └── toCsv.test.ts
│   ├── formatters/
│   │   ├── formatIsoLocal.test.ts
│   │   ├── formatDuration.test.ts
│   │   └── displayWidth.test.ts
│   ├── validators/
│   │   ├── validateName.test.ts
│   │   └── parseTimeInput.test.ts
│   └── repl/
│       ├── PromptRenderer.test.ts
│       └── CommandRouter.test.ts
├── integration/                   # 実ファイルに対する検証(機能単位)
│   ├── timer-lifecycle.test.ts    # start → stop → 再起動 → 復帰
│   ├── day-split-persistence.test.ts  # 日跨ぎ・月跨ぎの振り分け
│   ├── corrupted-data.test.ts     # 破損行のスキップ・マスタ欠損時のフォールバック
│   ├── atomic-write.test.ts       # 書き込み中断時にファイルが壊れないこと
│   └── permissions.test.ts        # 700 / 600 の確認
├── e2e/                           # REPL を起動したシナリオ検証
│   ├── first-run.test.ts          # 初回セットアップの最短経路
│   ├── daily-workflow.test.ts     # 1日の典型ワークフロー
│   ├── exit-and-recovery.test.ts  # 計測中の exit / 異常終了からの復帰
│   └── error-messages.test.ts     # エラー種別ごとの文言
└── helpers/
    ├── tempHome.ts                # TIMELOG_HOME に一時ディレクトリを割り当てる
    ├── scriptedIo.ts              # ReplIo の差し替え実装(入力列を与え出力を収集)
    └── fixtures.ts                # サンプルのマスタ・エントリ生成
```

**命名規則**:

| テスト種別 | 配置先 | 命名規則 | 例 |
|-----------|--------|---------|-----|
| ユニットテスト | `tests/unit/[src と同じ階層]/` | `[対象ファイル名].test.ts` | `splitByDay.test.ts` |
| 統合テスト | `tests/integration/` | `[機能].test.ts`（kebab-case） | `day-split-persistence.test.ts` |
| E2Eテスト | `tests/e2e/` | `[シナリオ].test.ts`（kebab-case） | `daily-workflow.test.ts` |

**ユニットテストだけ `src/` と同じ構造を保つ理由**: 対象ファイルと 1 対 1 に対応するため。
統合・E2E は複数のコンポーネントを横断するので、シナリオ名で並べる方が探しやすい。

**`src/` 内にテストを置かない**: `vitest.config.ts` は `src/**/*.test.ts` も対象に含む設定だが、
本プロジェクトではテストを `tests/` に集約する。ビルド対象（`tsconfig.json` の `include: ["src/**/*"]`）
からテストを除外する必要があり、共置するとビルド成果物にテストが混入するため。

### docs/ (ドキュメントディレクトリ)

| ファイル | 内容 |
|---------|------|
| `product-requirements.md` | プロダクト要求定義書 |
| `functional-design.md` | 機能設計書 |
| `architecture.md` | 技術仕様書 |
| `repository-structure.md` | 本ドキュメント |
| `development-guidelines.md` | 開発ガイドライン |
| `glossary.md` | 用語集 |
| `ideas/time-tracking-cli.md` | 壁打ちメモ（PRD の出典） |

## ファイル配置規則

### ソースファイル

| ファイル種別 | 配置先 | 命名規則 | 例 |
|------------|--------|---------|-----|
| エントリポイント | `src/` | `index.ts` | `src/index.ts` |
| REPL の構成要素（クラス） | `src/repl/` | PascalCase | `ReplSession.ts` |
| コマンドハンドラ | `src/repl/handlers/` | `[コマンド]Handler.ts` | `timerHandler.ts` |
| サービス（クラス） | `src/services/` | PascalCase + `Service` | `TimerService.ts` |
| 純粋ロジック（関数） | `src/domain/` | camelCase の動詞始まり | `splitByDay.ts` |
| ストア（クラス） | `src/stores/` | PascalCase + `Store` | `EntryStore.ts` |
| 整形関数 | `src/formatters/` | camelCase | `formatDuration.ts` |
| 検証関数 | `src/validators/` | camelCase | `validateName.ts` |
| 型・定数 | `src/types/` | camelCase の複数形 | `entities.ts` |

### 設定ファイル

| ファイル種別 | 配置先 | 命名規則 |
|------------|--------|---------|
| ツール設定 | プロジェクトルート | `[ツール名].config.{ts,js}` / ドットファイル |
| TypeScript 設定 | プロジェクトルート | `tsconfig.json` |
| アプリ定数 | `src/types/` | `constants.ts` |
| データパス解決 | `src/stores/` | `paths.ts` |

## 命名規則

### ディレクトリ名

- レイヤー / 集合を表すディレクトリは**複数形の kebab-case**: `services/`、`stores/`、`formatters/`、`validators/`、`handlers/`
- 例外として `repl/`、`domain/`、`types/` は複数形にしない。これらは「複数の何か」ではなく領域そのものを指す名前であり、`repls/` や `domains/` は意味が変わってしまう
- **`utils/` `helpers/` `common/` `misc/` は作らない**。役割が説明できない置き場は、責務の決まっていないコードの受け皿になる

### ファイル名

| 種別 | 規則 | 例 |
|------|------|-----|
| クラス | PascalCase + 役割接尾辞 | `TimerService.ts`、`EntryStore.ts` |
| 関数 | camelCase・動詞始まり | `splitByDay.ts`、`formatDuration.ts` |
| 型・定数の集合 | camelCase の名詞 | `entities.ts`、`constants.ts` |
| テスト | `[対象].test.ts` | `splitByDay.test.ts` |

### import の記法

`tsconfig.json` を `moduleResolution: "NodeNext"` に変更する方針（`docs/architecture.md` 参照）に伴い、
**相対 import には `.js` 拡張子を明示する**。

```typescript
// ✅ 正しい
import { splitByDay } from '../domain/splitByDay.js';
import type { Entry } from '../types/entities.js';

// ❌ 実行時に ERR_MODULE_NOT_FOUND となる
import { splitByDay } from '../domain/splitByDay';
```

型のみを import する場合は `import type` を使う。実行時の import 文が消え、
循環参照の温床を減らせる。

## 依存関係のルール

### レイヤー間の依存

```
                    index.ts
                       │ (すべてを import してよい唯一の場所)
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
     repl/  ──────▶ services/ ──────▶ stores/
        │              │                │
        │              ▼                │
        │           domain/             │
        │              │                │
        ▼              ▼                ▼
   formatters/     types/  ◀────────────┘
   validators/
```

**許可される依存**:

| From | To |
|------|-----|
| `index.ts` | すべて |
| `repl/` | `services/`、`formatters/`、`validators/`、`types/` |
| `services/` | `domain/`、`stores/`、`types/` |
| `domain/` | `types/`、`formatters/`（純粋関数のみ） |
| `stores/` | `types/` |
| `formatters/` / `validators/` | `types/` |
| `types/` | なし |

**禁止される依存**:

- `stores/` → `services/` / `repl/` ❌
- `services/` → `repl/` ❌
- `domain/` → `stores/` / `services/` / `repl/` ❌
- `repl/` → `stores/` / `domain/` ❌（サービスを迂回する経路を作らないため）
- `types/` → 任意のディレクトリ ❌

### 循環依存の禁止

**本プロジェクトで実際に発生し得る循環と、その回避策**:

#### ケース1: ProjectService ⇄ TimerService

```typescript
// ❌ 循環する例
// ProjectService.ts — 計測中かを知るために TimerService が必要
import { TimerService } from './TimerService.js';
class ProjectService {
  archiveTask(id: TaskId) {
    if (this.timerService.getCurrent()?.taskId === id) return err(...);  // 循環
  }
}
// TimerService.ts — lastUsedAt 更新のために ProjectService が必要
import { ProjectService } from './ProjectService.js';
```

```typescript
// ✅ 呼び出し順序を上位レイヤーへ持ち上げる
// repl/handlers/taskHandler.ts
const current = await timerService.getCurrent();
if (current?.taskId === task.id) {
  return error('計測中のタスクはアーカイブできません。...');
}
return projectService.archiveTask(projectId, task.id);
```

サービス間の依存は `TimerService → ProjectService` の一方向のみに固定する。

#### ケース2: 型の相互参照

型定義が複数ファイルに分かれると相互 import が起きやすい。
`src/types/` 配下は**エンティティを 1 ファイル（`entities.ts`）にまとめる**ことで回避する。
`Project` と `Task` を別ファイルに分けない。

#### 検出方法

ESLint の `import/no-cycle` 相当のルールを導入するか、
レビュー時に上記の依存表と突き合わせる。手動チェックで足りる規模だが、
`services/` のファイル数が増えた時点でルール導入を検討する。

## スケーリング戦略

### 機能の追加

| 規模 | 方針 | 例 |
|------|------|-----|
| 小規模（コマンド 1 つ） | 既存ディレクトリにファイルを追加 | `handlers/statsHandler.ts` を追加し `CommandRouter` に登録 |
| 中規模（新しい集計軸） | サービスにメソッドを追加し、純粋ロジックは `domain/` に切り出す | 週次サマリ（P2）→ `domain/summarize.ts` を期間指定に一般化 |
| 大規模（新しい出力形式） | `services/` にサービスを追加、生成ロジックは `domain/` へ | JSON 出力 → `domain/toJson.ts` + `ExportService` の分岐 |

**モジュール（機能単位）への分割は当面行わない**。
本プロダクトの機能は「プロジェクト管理」「計測」「集計」「出力」に分かれるが、
いずれも同じ `Entry` を中心に扱うため、機能で切ると型と store が重複して参照される。
レイヤーで切る現在の構造を維持する。

### ファイルサイズの管理

| 行数 | 対応 |
|------|------|
| 〜200 行 | 適正 |
| 200〜300 行 | 許容。責務が 1 つに収まっているか確認する |
| 300 行以上 | 分割を検討する |

**分割が想定されるファイル**:

- `ReplSession.ts` — 起動 / 復帰 / ループ / 終了の 4 フローを持つ。300 行を超えたら復帰フロー（`recoverTimer.ts`）に続いて起動シーケンスも切り出す
- `TimerService.ts` — `start` の自動 stop 分岐を含むため肥大しやすい。純粋計算は `domain/` へ寄せることで抑える
- `handlers/timerHandler.ts` — 4 コマンドを 1 ファイルに置いている。コマンドごとの分岐が増えたら分割する

### ディレクトリ内ファイル数の目安

10 ファイルを超えたらサブディレクトリを検討する。
現時点で最も多いのは `src/repl/handlers/`（9 ファイル）であり、
P2 の機能を追加する際にコマンド分類（`master/` `timer/` `report/`）での分割を検討する。

## 特殊ディレクトリ

### .steering/ (ステアリングファイル)

**役割**: 作業単位の「今回何をするか」を記録する。git 管理外（`.gitignore` で `.steering/*` を除外済み）

```
.steering/
└── [YYYYMMDD]-[task-name]/
    ├── requirements.md      # 今回の作業の要求内容
    ├── design.md            # 変更内容の設計
    └── tasklist.md          # タスクリスト
```

**命名規則**: `20260812-implement-mvp-core` 形式

### .claude/ (Claude Code 設定)

```
.claude/
├── commands/                # スラッシュコマンド(setup-project, add-feature, review-docs)
├── skills/                  # スキル(prd-writing, functional-design, architecture-design,
│                            #        repository-structure, development-guidelines,
│                            #        glossary-creation, steering)
└── agents/                  # サブエージェント(doc-reviewer, implementation-validator)
```

`settings.local.json` は個人設定のため git 管理外。

## 除外設定

### .gitignore（既存設定を維持）

現在の設定で本プロジェクトの要件を満たしている。追加すべき項目はない。

```
node_modules/  dist/  build/  *.tsbuildinfo
coverage/  .nyc_output/
.env  .env.local  .env.*.local
.steering/*  (!.steering/.gitkeep)
logs/  *.log  tmp/
.DS_Store  Thumbs.db  .vscode/  .idea/
.claude/settings.local.json
```

**`~/.timelog/` は対象外**: 実行時データはユーザーのホームディレクトリに置かれ、
リポジトリ内に生成されない。テスト時の一時ディレクトリも `fs.mkdtemp` が
OS の一時領域に作るため、リポジトリを汚さない。

### .prettierignore（既存設定を維持）

`docs/`、`.claude/`、`.steering/`、`CLAUDE.md`、`dist/`、`node_modules/` を除外済み。

### ESLint の ignores（既存設定を維持）

`eslint.config.js` で `node_modules/`、`dist/`、`.steering/` を除外済み。

## 実装着手時に行う整理

現在のリポジトリにはテンプレート由来のファイルが残っている。実装開始時に以下を処理する。

| 対象 | 対応 | 理由 |
|------|------|------|
| `src/example.ts` / `src/example.test.ts` | **削除** | テンプレートのサンプル。`src/` 直下にテストを置かない方針とも合わない |
| `mvp-log.json` | **削除** | 別サンプル（TaskCLI）の実行ログが残ったもので、timelog とは無関係 |
| `prompt.md` | 削除 | 実装指示のメモであり、リポジトリの成果物ではない |
| `tsconfig.json` | `module` / `moduleResolution` を `NodeNext` へ変更 | `docs/architecture.md` の「既存設定に必要な変更」を参照 |
| `package.json` | `name` を `timelog` に変更、`bin` / `engines` / `files` を追加、`@types/node` を `^24.0.0` へ | 同上 |
| `README.md` | timelog の概要・インストール・使い方に差し替え | テンプレートの説明のままになっている |
