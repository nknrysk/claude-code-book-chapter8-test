import { writeFile } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { entryPath } from '../../src/stores/paths.js';
import { runRepl } from '../helpers/replHarness.js';
import { buildServices, type Services } from '../helpers/services.js';
import { makeEntry } from '../helpers/fixtures.js';
import { useTempHome, type TempHome } from '../helpers/tempHome.js';

/** 与えた入力を 1 セッションで流し、出力全体を返す */
async function outputOf(services: Services, inputs: string[]): Promise<string> {
  const { io } = await runRepl({
    services,
    inputs: [...inputs, 'exit'],
    now: new Date(2026, 7, 12, 9, 0),
  });
  return io.text();
}

describe('エラーメッセージ', () => {
  let home: TempHome;
  let services: Services;

  beforeEach(async () => {
    home = await useTempHome();
    services = buildServices();
  });

  afterEach(async () => {
    await home.cleanup();
  });

  it('未知のコマンドは help を案内する', async () => {
    expect(await outputOf(services, ['strat 1'])).toContain(
      "不明なコマンドです: 'strat'。'help' でコマンド一覧を確認できます"
    );
  });

  it('プロジェクト未選択の task add / start は use を促す', async () => {
    const text = await outputOf(services, ['task add タスク', 'start 1']);

    expect(text).toContain(
      "プロジェクトが選択されていません。'use <プロジェクト名>' で選択してください"
    );
  });

  it('未登録プロジェクトの use は登録済み一覧を併記する', async () => {
    const text = await outputOf(services, ['project add myproj', 'use foo']);

    expect(text).toContain(
      "プロジェクト 'foo' は登録されていません。登録済み: myproj"
    );
  });

  it('同名のプロジェクト登録は重複として中止する', async () => {
    const text = await outputOf(services, [
      'project add myproj',
      'project add myproj',
    ]);

    expect(text).toContain(
      "プロジェクト 'myproj' は既に登録されています。'project list' で確認してください"
    );
  });

  it('同名のタスク登録は重複として中止する', async () => {
    const text = await outputOf(services, [
      'project add myproj',
      'use myproj',
      'task add 認証API実装',
      'task add 認証API実装',
    ]);

    expect(text).toContain(
      "タスク '認証API実装' は既に登録されています。'task list' で確認してください"
    );
  });

  it('長すぎる名前は 1〜100 文字の指定を促す', async () => {
    const text = await outputOf(services, [`project add ${'a'.repeat(101)}`]);

    expect(text).toContain('プロジェクト名は 1〜100 文字で指定してください');
  });

  it('範囲外の番号は指定可能な範囲を示す', async () => {
    const text = await outputOf(services, [
      'project add myproj',
      'use myproj',
      'task add 認証API実装',
      'start 99',
    ]);

    expect(text).toContain(
      '番号 99 は範囲外です。1〜1 の番号か、タスク名の一部を指定してください'
    );
  });

  it('一致するタスクが無い場合は task list を案内する', async () => {
    const text = await outputOf(services, [
      'project add myproj',
      'use myproj',
      'task add 認証API実装',
      'start 存在しない',
    ]);

    expect(text).toContain(
      "'存在しない' に一致するタスクがありません。'task list' で一覧を確認してください"
    );
  });

  it('候補が複数ある場合は番号付きで候補を提示する', async () => {
    const text = await outputOf(services, [
      'project add myproj',
      'use myproj',
      'task add 認証API実装',
      'task add API仕様レビュー',
      'start API',
    ]);

    expect(text).toContain("'API' に複数のタスクが一致します:");
    expect(text).toContain('認証API実装');
    expect(text).toContain('API仕様レビュー');
    expect(text).toContain('番号で指定してください');
  });

  it('非計測時の stop / note は状態を変えずに start を促す', async () => {
    const text = await outputOf(services, ['stop', 'note メモ']);

    expect(text).toContain(
      "計測していません。'start <番号|名前>' で開始してください"
    );
  });

  it('確定エントリが無い状態の resume は start を促す', async () => {
    expect(await outputOf(services, ['resume'])).toContain(
      "再開できるエントリがありません。'start <番号|名前>' で開始してください"
    );
  });

  it('日付の形式が不正な show は形式を示す', async () => {
    expect(await outputOf(services, ['show 2026/08/12'])).toContain(
      "日付 '2026/08/12' の形式が不正です。'YYYY-MM-DD' の形式で指定してください"
    );
  });

  it('help に無いコマンド名を渡すと一覧を案内する', async () => {
    expect(await outputOf(services, ['help strat'])).toContain(
      "'strat' というコマンドはありません。'help' でコマンド一覧を確認できます"
    );
  });

  it('JSONL の破損行は警告を出して残りを表示する', async () => {
    const { ensureDataDir } = await import('../../src/stores/ensureDataDir.js');
    await ensureDataDir();
    await writeFile(
      entryPath('2026-08'),
      `${JSON.stringify(makeEntry())}\n{壊れた行\n`,
      { mode: 0o600 }
    );

    const text = await outputOf(services, ['show 2026-08-12']);

    expect(text).toContain('2 行目を読み飛ばしました(不正なJSON)');
    expect(text).toContain('認証API実装');
  });

  it('マスタが見つからないエントリはスナップショット名で表示し警告する', async () => {
    const { ensureDataDir } = await import('../../src/stores/ensureDataDir.js');
    await ensureDataDir();
    await writeFile(entryPath('2026-08'), `${JSON.stringify(makeEntry())}\n`, {
      mode: 0o600,
    });

    const text = await outputOf(services, ['show 2026-08-12']);

    expect(text).toContain(
      '一部のエントリでプロジェクト/タスクが見つかりません。記録時の名前で表示しています'
    );
    expect(text).toContain('認証API実装');
  });

  it('help は全コマンドの一覧を表示する', async () => {
    const text = await outputOf(services, ['help']);

    for (const command of [
      'project add',
      'use',
      'task add',
      'start',
      'stop',
      'resume',
      'note',
      'show',
      'help',
      'exit',
    ]) {
      expect(text).toContain(command);
    }
  });
});
