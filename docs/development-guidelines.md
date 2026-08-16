# 開発ガイドライン (Development Guidelines)

作成日: 2026-08-12
対象: `docs/architecture.md` / `docs/repository-structure.md` に基づく実装規約と開発プロセス

## プロジェクト固有の必須ルール

一般的な規約より先に、**本プロジェクトで守らないと設計が崩れる 6 つのルール**を挙げる。
レビューではこの 6 点を最優先で確認する。

| # | ルール | 破ると何が起きるか |
|---|--------|-------------------|
| 1 | サービスレイヤーで `new Date()` を呼ばない。現在時刻は引数で受け取る | 日跨ぎ分割のテストがシステムクロックに依存し、検証できなくなる |
| 2 | サービスレイヤーは想定内のエラーで例外を投げない。`Result<T, E>` を返す | エラーの網羅性をコンパイラが検査できず、メッセージの出し漏れが起きる |
| 3 | `src/domain/` に副作用を持ち込まない（I/O・現在時刻・コンソール出力） | 純粋ロジックのテストにファイルシステムが必要になる |
| 4 | エントリを生成する際は ID と名前スナップショットを**必ず両方**書く | `projects.json` を失った時に履歴が読めなくなる |
| 5 | 相対 import に `.js` 拡張子を付ける | ビルドは通り、テストも通り、`node dist/index.js` だけが起動しない |
| 6 | `dependencies`（実行時依存）を追加しない | 「ネットワーク通信を一切行わない」という保証が構造的に崩れる |

## コーディング規約

### 命名規則

#### 変数・関数

```typescript
// ✅ 良い例
const activeTasks = await projectService.listTasks(projectId, false);
function splitByDay(start: Date, end: Date): Segment[] { }
const isMeasuring = current !== null;

// ❌ 悪い例
const data = await get();          // 何のデータか分からない
function proc(a: Date, b: Date) { } // 動詞が具体的でない
const flag = current !== null;      // Boolean が何を表すか分からない
```

**原則**:

- 変数: camelCase、名詞または名詞句
- 関数: camelCase、動詞で始める
- 定数: UPPER_SNAKE_CASE（`src/types/constants.ts` に集約）
- Boolean: `is` / `has` / `should` で始める

#### 本プロジェクトの語彙

**`docs/glossary.md` の用語をそのままコードの識別子に使う。**
日本語の概念に対して英語名が揺れると、ドキュメントとコードの対応が追えなくなる。

| 概念 | 識別子 | 使ってはいけない別名 |
|------|--------|---------------------|
| 実績エントリ | `entry` / `Entry` | `record`、`log`、`item` |
| 計測中の状態 | `current` / `CurrentTimer` | `active`、`running`、`session` |
| 表示連番 | `index` / `lineNo` | `id`（内部IDと紛れるため厳禁） |
| 内部ID | `projectId` / `taskId` | `key`、`uid` |
| 日跨ぎ分割 | `splitByDay` / `segment` | `divide`、`chunk` |
| 名前のスナップショット | `projectName` / `taskName` | `cachedName`、`label` |
| アーカイブ | `archived` | `deleted`、`hidden`、`closed` |

**`id` という裸の変数名を使わない**。本プロジェクトには「内部ID」と「表示連番」という
混同すると事故る 2 つの識別子がある。必ず `taskId` / `lineNo` のように何のIDかを名前に含める。

#### クラス・インターフェース・型

```typescript
// クラス: PascalCase + 役割接尾辞
class TimerService { }
class EntryStore { }

// インターフェース: PascalCase、I 接頭辞を付けない
interface Entry { }
interface ReplIo { }

// 型エイリアス: PascalCase
type TaskId = string;
type Result<T, E = AppError> = { ok: true; value: T } | { ok: false; error: E };
```

**`I` 接頭辞を付けない理由**: 本プロジェクトでインターフェースを使うのは
`ReplIo`（テスト差し替え）と各エンティティ型のみで、実装クラスと名前が衝突しない。

### 型定義

```typescript
// ✅ 良い例: ブランド化されたプリミティブで取り違えを防ぐ
type ProjectId = string;
type TaskId = string;
function archiveTask(projectId: ProjectId, taskId: TaskId): Promise<Result<Task>>;

// ✅ 良い例: 判別可能ユニオンで網羅性を保証する
type ResolveError =
  | { kind: 'IndexOutOfRange'; input: string; max: number }
  | { kind: 'NotFound'; input: string }
  | { kind: 'Ambiguous'; input: string; candidates: Task[] };

// ❌ 悪い例: any / 型アサーションでの逃げ
const entry = JSON.parse(line) as Entry;   // 検証していない
```

**`any` は使わない**（ESLint で warn 設定。レビューでは error として扱う）。
外部から来る値（JSON パース結果）は `unknown` で受け、**型ガードで検証してから使う**。

```typescript
// ✅ JSONL の 1 行を読む場合
function parseEntry(line: string): Entry | null {
  let raw: unknown;
  try {
    raw = JSON.parse(line);
  } catch {
    return null;   // 破損行はスキップする(呼び出し側が警告を出す)
  }
  return isEntry(raw) ? raw : null;
}

function isEntry(v: unknown): v is Entry {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.date === 'string' &&
    typeof o.start === 'string' &&
    typeof o.end === 'string' &&
    typeof o.minutes === 'number' &&
    typeof o.projectId === 'string' &&
    typeof o.taskId === 'string'
  );
}
```

### 関数設計

**1 関数 1 責務。`src/domain/` は 1 ファイル 1 エクスポート関数を原則とする。**

```typescript
// ✅ 良い例: 純粋関数。入力と出力だけで正しさが定義できる
export function splitByDay(start: Date, end: Date): Segment[] {
  const segments: Segment[] = [];
  let cursor = start;
  while (cursor < end) {
    const boundary = startOfNextDay(cursor);
    const segEnd = boundary < end ? boundary : end;
    segments.push({ start: cursor, end: segEnd });
    cursor = segEnd;
  }
  return segments.length > 0 ? segments : [{ start, end }];
}

// ❌ 悪い例: 現在時刻とファイル I/O が混ざり、テストできない
export async function stopTimer() {
  const now = new Date();                        // ルール1 違反
  const current = JSON.parse(await readFile(...)); // ルール3 違反
  // ...
}
```

**引数が 4 つを超えたらオブジェクトにまとめる**。

```typescript
// ❌ 呼び出し側で順序を間違えても型が通ってしまう
function addEntry(date: string, start: string, end: string, projectId: string, taskId: string, note: string)

// ✅
function addEntry(params: { date: DateString; start: IsoDateTime; end: IsoDateTime; projectId: ProjectId; taskId: TaskId; note?: string })
```

### エラーハンドリング

本プロジェクトは**想定内のエラーと真の異常を明確に分ける**。

#### 想定内のエラー: `Result` を返す

```typescript
// src/types/result.ts
export type Result<T, E = AppError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
```

```typescript
// ✅ サービスレイヤー
async stop(now: Date): Promise<Result<Entry[]>> {
  const current = await this.currentStore.load();
  if (current === null) {
    return err({ kind: 'NotMeasuring' });
  }
  const entries = buildEntries(new Date(current.start), now, current);
  await this.entryStore.append(entries);
  await this.currentStore.clear();
  return ok(entries);
}
```

```typescript
// ✅ REPL レイヤー: switch の網羅性をコンパイラが検査する
switch (result.error.kind) {
  case 'NotMeasuring':
    return io.write(red("計測していません。'start <番号|名前>' で開始してください"));
  case 'NotFound':
    return io.write(red(`'${result.error.input}' に一致するタスクがありません。'task list' で一覧を確認してください`));
  // ...
  default: {
    const _exhaustive: never = result.error;   // ケース漏れがあればここで型エラー
    throw new Error(`未処理のエラー: ${JSON.stringify(_exhaustive)}`);
  }
}
```

#### 真の異常: 例外を投げ、最上位で捕捉する

I/O エラー、`projects.json` の破損など、プログラムが対処できない事象のみ例外を使う。

```typescript
// src/types/errors.ts
export class DataCorruptedError extends Error {
  constructor(
    message: string,
    public readonly filePath: string,
    public readonly rawContent: string
  ) {
    super(message);
    this.name = 'DataCorruptedError';
  }
}
```

```typescript
// ReplSession の入力ループ最上位
try {
  await router.dispatch(cmd, ctx);
} catch (error) {
  // 予期しない例外でもループは止めない。記録は保存済みであることを伝える
  io.write(red(`予期しないエラーが発生しました: ${String(error)}`));
  if (error instanceof Error && error.stack) io.write(gray(error.stack));
  io.write('記録は保存されています。続行できます');
}
```

#### エラーメッセージの規約

**すべてのエラーメッセージは「何が問題か」と「次に何をすべきか」の両方を含む**（PRD 非機能要件）。

```typescript
// ✅ 良い例
"番号 99 は範囲外です。1〜3 の番号か、タスク名の一部を指定してください"
"プロジェクトが選択されていません。'use <プロジェクト名>' で選択してください"

// ❌ 悪い例
"Invalid index"           // 英語、次の行動が不明
"タスクが見つかりません"      // 次に何をすればいいか分からない
"Error: ENOENT"           // 生の例外をそのまま出している
```

- メッセージは**日本語**。利用者は日本語話者の個人であり、英語にする理由がない
- 打つべきコマンドは `'...'` で囲んで明示する
- メッセージ文字列は各ハンドラにベタ書きせず、**エラー種別ごとの整形関数に集約する**（E2E テストで文言を検証するため）

### 非同期処理

```typescript
// ✅ 良い例: async/await + 独立した I/O は並列化
const [projects, current] = await Promise.all([
  projectStore.load(),
  currentStore.load(),
]);

// ❌ 悪い例: 同期 I/O(REPL の入力応答をブロックする)
const projects = JSON.parse(readFileSync(path, 'utf8'));

// ❌ 悪い例: await 忘れ(書き込み完了前に次へ進む)
currentStore.save(timer);   // Promise が浮いている
```

**`fs.*Sync` は使わない**。ESLint でチェックする場合は `no-restricted-imports` ではなく
レビューで確認する（Node 標準モジュール内の特定関数は静的に禁止しづらいため）。

**書き込みは必ず `await` する**。特に `current.json` の保存は「異常終了しても開始時刻を失わない」
という信頼性要件の要であり、完了前に次の処理へ進んではならない。

### コードフォーマット

`.prettierrc` の設定に従う（Prettier が唯一の権威。手動整形しない）。

| 項目 | 設定 |
|------|------|
| インデント | 2 スペース |
| 行の長さ | 80 文字（Prettier の既定） |
| セミコロン | あり |
| クォート | シングル |

コミット時に husky + lint-staged が `eslint --fix` と `prettier --write` を実行するため、
フォーマットについてレビューで議論しない。

### コメント規約

#### ドキュメントコメント

公開関数・クラスには TSDoc を書く。**特に「なぜその実装なのか」を残す。**

```typescript
/**
 * 計測区間を日付境界で分割し、エントリ配列を生成する。
 *
 * 分割の前に開始・終了時刻を分単位へ切り捨てる。日付境界(00:00)は常に分の倍数のため、
 * 分単位に揃った区間を割る限り各セグメントは整数分となり、
 * 分割後の合計が分割前と厳密に一致する。セグメントごとに独立して秒を切り捨てると、
 * 誤差がセグメント数だけ累積して合計が合わなくなる。
 *
 * @param rawStart - 計測開始時刻(秒精度)
 * @param rawEnd - 計測終了時刻(秒精度)
 * @param timer - 計測中の状態。プロジェクト/タスクのIDと名前スナップショットを供給する
 * @returns 日付ごとに分割されたエントリ。日跨ぎがなければ 1 件
 */
export function buildEntries(rawStart: Date, rawEnd: Date, timer: CurrentTimer): Entry[] {
```

#### インラインコメント

```typescript
// ✅ 良い例: なぜそうするかを説明
// 一時ファイルは対象と同じディレクトリに作る。/tmp を経由すると
// 別ファイルシステムになり得て、rename の原子性が失われる
const tmp = `${target}.tmp.${process.pid}`;

// ✅ 良い例: 集約キーの選択理由
// 名前ではなく ID で束ねる。リネーム前後のエントリが別行に割れるのを防ぐ
const key = `${entry.projectId} ${entry.taskId}`;

// ❌ 悪い例: コードを読めば分かること
// tmp に書き込む
await fs.writeFile(tmp, content);
```

### マジックナンバーの排除

```typescript
// ❌ 悪い例
if (name.length > 100) return err(...);
const minutes = (end - start) / 60000;

// ✅ 良い例: src/types/constants.ts に集約
export const NAME_MAX_LENGTH = 100;
export const MS_PER_MINUTE = 60_000;
export const ID_BODY_LENGTH = 6;
export const ID_ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz'; // Crockford Base32
export const CSV_HEADERS = ['日付', '開始時刻', '終了時刻', '作業時間', 'プロジェクト', 'タスク', '備考'] as const;
```

### セキュリティ

```typescript
// ✅ ファイル作成時に mode を指定する。作成後の chmod では
//    その隙間に他ユーザーが読める瞬間が生まれる
await fs.mkdir(dir, { recursive: true, mode: 0o700 });
await fs.writeFile(path, content, { mode: 0o600, encoding: 'utf8' });

// ✅ 制御文字を登録時点で拒否する(ANSI エスケープによる表示破壊を防ぐ)
if (/[\x00-\x1F\x7F]/.test(name)) {
  return err({ kind: 'InvalidName', reason: 'control-character' });
}

// ✅ CSV インジェクション対策
function guardFormula(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}
```

**データディレクトリのパスをユーザー入力から組み立てない**。
`src/stores/paths.ts` が `os.homedir()` または `TIMELOG_HOME` から決定する唯一の場所である。

## Git運用ルール

### ブランチ戦略（Git Flow）

```
main                    # リリース可能な状態
  └─ develop            # 開発の最新状態(現在のデフォルト作業ブランチ)
      ├─ feature/timer-core
      ├─ feature/day-split
      ├─ fix/prompt-elapsed-time
      └─ refactor/entry-store
```

| ブランチ | 用途 | マージ先 |
|---------|------|---------|
| `main` | リリース可能な状態 | — |
| `develop` | 開発の最新状態 | `main` |
| `feature/[機能名]` | 新機能開発 | `develop` |
| `fix/[修正内容]` | バグ修正 | `develop` |
| `refactor/[対象]` | リファクタリング | `develop` |
| `docs/[対象]` | ドキュメントのみの変更 | `develop` |

**`main` / `develop` へ直接コミットしない。** 必ずブランチを切って PR 経由でマージする。

### コミットメッセージ規約（Conventional Commits）

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type**:

| type | 用途 |
|------|------|
| `feat` | 新機能 |
| `fix` | バグ修正 |
| `docs` | ドキュメント |
| `style` | フォーマット（動作に影響しない） |
| `refactor` | リファクタリング |
| `test` | テストの追加・修正 |
| `chore` | ビルド・ツール・設定 |

**Scope**（本プロジェクトのレイヤー / 機能に対応させる）:

`repl` / `timer` / `project` / `report` / `export` / `store` / `domain` / `types` / `config`

**例**:

```
feat(timer): 日跨ぎ分割を stop 時に適用する

計測が日付をまたいだ場合、日付境界ごとにエントリを分割して記録するようにした。
分割の前に開始・終了時刻を分単位へ切り捨てることで、分割後の作業時間の合計が
分割前と厳密に一致することを保証している。

- domain/splitByDay.ts: 境界ごとのループによる分割(回数の上限なし)
- domain/buildEntries.ts: 切り捨て → 分割 → Entry 生成
- EntryStore.append: 月をまたぐ場合の振り分け

Closes #12
```

**subject の書き方**:

- 日本語、50 文字以内、句点を付けない
- 「〜した」ではなく「〜する」（命令形に近い形）で統一する
- 何を変えたかではなく**何ができるようになったか**を書く

```
✅ feat(timer): 日跨ぎ分割を stop 時に適用する
❌ feat(timer): splitByDay.ts を追加             # ファイル名は body に書く
❌ fix: バグ修正                                  # 何のバグか分からない
```

### プルリクエストプロセス

**作成前のセルフチェック**:

- [ ] `npm run typecheck` がパス
- [ ] `npm run lint` がパス
- [ ] `npm run test:coverage` がパス（閾値 80%）
- [ ] `npm run build && node dist/index.js --version` が起動する
- [ ] `package.json` の `dependencies` が空のまま
- [ ] 冒頭の「プロジェクト固有の必須ルール」6 点に違反していない

**PRテンプレート**:

```markdown
## 概要
[変更内容の簡潔な説明]

## 変更の種類
- [ ] feat（新機能）
- [ ] fix（バグ修正）
- [ ] refactor（リファクタリング）
- [ ] docs（ドキュメント）

## 変更理由
[なぜこの変更が必要か。どのドキュメントの要件に対応するか]

関連ドキュメント: docs/product-requirements.md の「[機能名]」

## 変更内容
- [変更点1]
- [変更点2]

## テスト
- [ ] ユニットテスト追加
- [ ] 統合テスト追加
- [ ] E2Eテスト追加
- [ ] REPL を実際に起動して手動確認

### 確認したシナリオ
[実行したコマンド列と結果]

## 設計ドキュメントとの差分
[設計と異なる実装をした場合、その内容と理由。なければ「なし」]

## 関連Issue
Closes #[Issue番号]
```

**「設計ドキュメントとの差分」欄を設ける理由**: スペック駆動開発では、
実装中に判明した設計の不備をドキュメントへ還元する必要がある。
PR で差分を明示させることで、`docs/` の更新漏れを防ぐ。

**レビュープロセス**:

1. セルフレビュー（差分を自分で読み直す）
2. 自動チェック（typecheck / lint / test / build）
3. レビュアーによるレビュー
4. フィードバック対応
5. 承認後 `develop` へマージ（squash merge）

## テスト戦略

### テストピラミッド

```
        ▲
       ╱ ╲     E2E (少数・高価値)
      ╱───╲    4 シナリオ: 初回起動 / 日常フロー / 終了と復帰 / エラー文言
     ╱     ╲
    ╱───────╲  統合 (中程度)
   ╱         ╲ 5 本: ライフサイクル / 日跨ぎ永続化 / 破損データ / 原子性 / 権限
  ╱───────────╲
 ╱             ╲ ユニット (多数・高速)
╱───────────────╲ domain / formatters / validators / repl の整形処理
```

**本プロジェクトはユニットテストの比重を高くできる構造になっている。**
最も壊れやすい日跨ぎ分割とタスク解決が `src/domain/` の純粋関数として切り出されているため、
ファイルシステムも時刻モックも使わずに境界ケースを網羅できる。

### テストの構造（Given-When-Then）

```typescript
describe('splitByDay', () => {
  it('日付をまたぐ計測を境界で 2 件に分割する', () => {
    // Given: 23:30 に開始し翌日 00:20 に終了した計測
    const start = new Date('2026-08-12T23:30:00+09:00');
    const end = new Date('2026-08-13T00:20:00+09:00');

    // When
    const segments = splitByDay(start, end);

    // Then
    expect(segments).toHaveLength(2);
    expect(segments[0].end).toEqual(new Date('2026-08-13T00:00:00+09:00'));
    expect(segments[1].start).toEqual(new Date('2026-08-13T00:00:00+09:00'));
  });
});
```

### テスト命名規則

**日本語で「条件」と「期待結果」を書く。**

```typescript
// ✅ 良い例: 仕様書として読める
it('日付をまたぐ計測を境界で 2 件に分割する', () => {});
it('部分一致が複数件のとき Ambiguous エラーを候補付きで返す', () => {});
it('アーカイブ済みタスクを番号の解決対象から除外する', () => {});
it('projects.json が存在しないときスナップショット名にフォールバックする', () => {});

// ❌ 悪い例
it('works', () => {});
it('test splitByDay', () => {});
it('should return correct value', () => {});
```

**日本語を採用する理由**: 受け入れ条件は PRD に日本語で書かれている。
テスト名を日本語にすることで、PRD の受け入れ条件とテストが 1 対 1 で対応しているか
目視で確認できる。

### 境界値・テーブル駆動テスト

日跨ぎ分割のように「性質」を検証すべきものは、テーブル駆動で網羅する。

```typescript
describe('buildEntries: 分割前後で作業時間の合計が一致する', () => {
  const cases = [
    { name: '日跨ぎなし',   start: '2026-08-12T09:12:30+09:00', end: '2026-08-12T10:17:45+09:00', expectedSegments: 1, expectedTotal: 65 },
    { name: '1 回分割',     start: '2026-08-12T23:30:00+09:00', end: '2026-08-13T00:20:00+09:00', expectedSegments: 2, expectedTotal: 50 },
    { name: '3 日跨ぎ',     start: '2026-08-14T18:00:00+09:00', end: '2026-08-17T09:00:00+09:00', expectedSegments: 4, expectedTotal: 3780 },
    { name: '月跨ぎ',       start: '2026-08-31T22:00:00+09:00', end: '2026-09-01T01:00:00+09:00', expectedSegments: 2, expectedTotal: 180 },
    { name: '0 分',         start: '2026-08-12T09:00:10+09:00', end: '2026-08-12T09:00:50+09:00', expectedSegments: 1, expectedTotal: 0 },
  ];

  it.each(cases)('$name', ({ start, end, expectedSegments, expectedTotal }) => {
    const entries = buildEntries(new Date(start), new Date(end), timerFixture);
    expect(entries).toHaveLength(expectedSegments);
    expect(entries.reduce((sum, e) => sum + e.minutes, 0)).toBe(expectedTotal);
  });
});
```

### モック・スタブの方針

| 対象 | 方針 |
|------|------|
| `src/domain/` | **モック不要**。純粋関数のため実物をそのまま使う |
| ファイルシステム | **モックしない**。`fs.mkdtemp` で作った一時ディレクトリを `TIMELOG_HOME` に割り当て、実ファイルで検証する |
| 現在時刻 | **モックしない**。引数で `Date` を渡す |
| 標準入出力 | `ReplIo` インターフェースを差し替える（`tests/helpers/scriptedIo.ts`） |

**ファイルシステムをモックしない理由**: 本プロジェクトの信頼性要件（原子的書き込み、
パーミッション 700/600、追記の安全性）は、**実際のファイルシステムの挙動に依存している**。
`fs` をモックすると、これらが検証されないままテストだけが緑になる。
一時ディレクトリを使えば十分に高速で、かつ本物を検証できる。

```typescript
// tests/helpers/tempHome.ts の利用例
let home: string;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), 'timelog-test-'));
  process.env.TIMELOG_HOME = home;
});

afterEach(async () => {
  await fs.rm(home, { recursive: true, force: true });
  delete process.env.TIMELOG_HOME;
});
```

### カバレッジ目標

`vitest.config.ts` に設定済みの閾値を維持する。

| 指標 | 閾値 |
|------|------|
| branches | 80% |
| functions | 80% |
| lines | 80% |
| statements | 80% |

**`src/domain/` は実質 100% を目指す**。ここは分岐が少なく副作用がないため、
網羅しない理由がない。逆に `src/index.ts`（依存の結線のみ）は E2E で通ることをもって足りる。

**カバレッジは下限であって目標ではない**。数値を満たすためだけのテストを書かない。

## コードレビュー基準

### レビューポイント

**プロジェクト固有（最優先）**:

- [ ] サービスレイヤーで `new Date()` を呼んでいないか
- [ ] 想定内のエラーで例外を投げていないか（`Result` を返しているか）
- [ ] `src/domain/` に I/O が紛れ込んでいないか
- [ ] エントリ生成時に ID と名前スナップショットを両方書いているか
- [ ] 相対 import に `.js` 拡張子が付いているか
- [ ] `dependencies` が増えていないか
- [ ] レイヤー間の依存方向が `docs/repository-structure.md` の表に従っているか

**機能性**:

- [ ] PRD の受け入れ条件を満たしているか（対応する条件を PR に明記しているか）
- [ ] エッジケース（日跨ぎ、0 分、アーカイブ済み、マスタ欠損）が考慮されているか
- [ ] エラーメッセージが「何が問題か」と「次に何をすべきか」の両方を含むか

**可読性**:

- [ ] 用語集の語彙を使っているか（`id` という裸の変数名がないか）
- [ ] なぜその実装なのかがコメントに残っているか（特に非自明な判断）

**保守性**:

- [ ] 責務が 1 つに収まっているか
- [ ] 300 行を超えるファイルが生まれていないか
- [ ] 同じロジックが 2 箇所に書かれていないか（特に名前解決・時刻整形）

**パフォーマンス**:

- [ ] `fs.*Sync` を使っていないか
- [ ] アイドル時に動くタイマー・ポーリングを追加していないか
- [ ] `resolveTask` / `listTasks` でファイル I/O が発生していないか

**セキュリティ**:

- [ ] ファイル・ディレクトリ生成時に `mode` を指定しているか
- [ ] ネットワークアクセスを追加していないか
- [ ] CSV 出力にエスケープとインジェクション対策が入っているか

### レビューコメントの書き方

**優先度を明示する**:

| 記号 | 意味 |
|------|------|
| `[必須]` | 修正しないとマージできない |
| `[推奨]` | 修正した方がよい。議論の余地あり |
| `[提案]` | 検討してほしい。従わなくてよい |
| `[質問]` | 理解のための質問 |

```markdown
✅ 良い例
[必須] ここで `new Date()` を呼ぶと、日跨ぎ分割のテストが
システムクロックに依存してしまいます。引数で受け取る形にできますか？
（docs/development-guidelines.md「プロジェクト固有の必須ルール」1 番）

[提案] この分岐は `resolveTask` と同じ判定をしているように見えます。
domain 側に寄せると両方から使えそうです。

❌ 悪い例
この書き方は良くないです。
```

**指摘には根拠を添える**。ドキュメントの該当箇所か、具体的に何が起きるかを示す。

## 開発環境セットアップ

### 必要なツール

| ツール | バージョン | 備考 |
|--------|-----------|------|
| Docker / VS Code | — | devcontainer の起動に必要 |
| Node.js | v24 系 | devcontainer に同梱 |
| npm | 11.x | Node.js 同梱 |
| Git | 2.x | — |

### セットアップ手順

```bash
# 1. リポジトリを開く(VS Code の Dev Containers 拡張で「コンテナで再度開く」)
git clone [URL]
code claude-code-book-chapter8-test

# 2. 依存関係のインストール(devcontainer 内)
npm install

# 3. 動作確認
npm run typecheck
npm run lint
npm run test

# 4. ビルドと起動
npm run build
node dist/index.js
```

**環境変数の設定は不要**。本プロダクトは設定ファイルも API キーも持たない。
`TIMELOG_HOME` はテスト用途のみで、通常の開発では設定しない。

### 開発中に使うコマンド

| コマンド | 用途 |
|---------|------|
| `npm run dev` | `tsc --watch` による継続ビルド |
| `npm run test:watch` | テストの継続実行 |
| `npm run test:ui` | Vitest UI でテスト結果を確認 |
| `npm run test:coverage` | カバレッジ計測（PR 前に実行） |
| `npm run typecheck` | 型検査のみ |
| `npm run lint` | ESLint |
| `npm run format` | Prettier による一括整形 |

## 品質の自動化

### コミット時（husky + lint-staged）

`.husky/pre-commit` で以下が実行される（既存設定）。

```
*.{ts,tsx} → eslint --fix → prettier --write
```

### PR 時に実行すべきチェック

CI が未構築のため、当面は PR 作成者が手元で実行する。CI を構築する際は以下を移植する。

```bash
npm run typecheck
npm run lint
npm run test:coverage
npm run build && node dist/index.js --version   # 実行時エラーの検出
node -e "process.exit(Object.keys(require('./package.json').dependencies ?? {}).length)"  # 実行時依存ゼロの確認
```

**`build && 起動確認` を必ず含める**。`moduleResolution` の設定や `.js` 拡張子の
付け忘れは Vitest では検出できず、テストが全て緑のまま実バイナリだけが起動しないという
形で顕在化する。この 1 コマンドがその唯一の防波堤になる。

## スペック駆動開発との連携

本プロジェクトは `CLAUDE.md` に定義されたスペック駆動開発に従う。

| フェーズ | 参照するドキュメント | 成果物 |
|---------|-------------------|--------|
| 作業計画 | `docs/` の永続ドキュメント一式 | `.steering/[YYYYMMDD]-[タスク名]/requirements.md` `design.md` `tasklist.md` |
| 実装 | 上記 + 本ガイドライン | ソースコード、`tasklist.md` の進捗更新 |
| 検証 | PRD の受け入れ条件 | テスト、振り返り |
| 更新 | — | 設計と実装がずれた場合の `docs/` 更新 |

**実装前に必ず確認する**:

1. `CLAUDE.md`
2. 関連する `docs/` のドキュメント（特に PRD の受け入れ条件）
3. Grep による既存の類似実装の確認
4. 本ガイドラインの「プロジェクト固有の必須ルール」

**ドキュメントと実装が食い違った場合**: 実装を黙って進めず、
どちらが正しいかを判断してドキュメント側も更新する。
`docs/` が「北極星」である以上、古いまま放置された設計書は実装より有害になる。
