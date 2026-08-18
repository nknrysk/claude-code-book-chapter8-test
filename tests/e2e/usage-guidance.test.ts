import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runRepl } from '../helpers/replHarness.js';
import { buildServices, type Services } from '../helpers/services.js';
import { useTempHome, type TempHome } from '../helpers/tempHome.js';

async function outputOf(services: Services, inputs: string[]): Promise<string> {
  const { io } = await runRepl({
    services,
    inputs: [...inputs, 'exit'],
    now: new Date(2026, 7, 12, 9, 0),
  });
  return io.text();
}

describe('引数不足時の使い方の案内', () => {
  let home: TempHome;
  let services: Services;

  beforeEach(async () => {
    home = await useTempHome();
    services = buildServices();
  });

  afterEach(async () => {
    await home.cleanup();
  });

  it.each([
    ['project', 'project add <名前> / project list'],
    ['project add', 'project add <名前>'],
    ['use', 'use <プロジェクト>'],
  ])('%s は使い方を示す', async (input, usage) => {
    expect(await outputOf(services, [input])).toContain(`使い方: ${usage}`);
  });

  it.each([
    ['task', 'task add <名前> / task list'],
    ['task add', 'task add <名前>'],
    ['start', 'start <番号|名前> [備考]'],
  ])('プロジェクト選択後の %s は使い方を示す', async (input, usage) => {
    const text = await outputOf(services, [
      'project add myproj',
      'use myproj',
      input,
    ]);

    expect(text).toContain(`使い方: ${usage}`);
  });

  it('計測中の note は引数が無ければ使い方を示す', async () => {
    const text = await outputOf(services, [
      'project add myproj',
      'use myproj',
      'task add 認証API実装',
      'start 1',
      'note',
    ]);

    expect(text).toContain('使い方: note <テキスト>');
  });

  it('タスク未登録での task list は登録を案内する', async () => {
    const text = await outputOf(services, [
      'project add myproj',
      'use myproj',
      'task list',
    ]);

    expect(text).toContain(
      "タスクが登録されていません。'task add <名前>' で登録してください"
    );
  });

  it('タスクが 0 件のときの番号指定は登録を案内する', async () => {
    const text = await outputOf(services, [
      'project add myproj',
      'use myproj',
      'start 1',
    ]);

    expect(text).toContain(
      "番号 1 は範囲外です。'task add <名前>' でタスクを登録してください"
    );
  });

  it('help <コマンド名> は引数と使用例を表示する', async () => {
    const text = await outputOf(services, ['help start']);

    expect(text).toContain('start <番号|名前> [備考]');
    expect(text).toContain('計測を開始する');
    expect(text).toContain('例: start 1');
  });

  it('サブコマンドを持つ help project は両方をまとめて表示する', async () => {
    const text = await outputOf(services, ['help project']);

    expect(text).toContain('project add <名前>');
    expect(text).toContain('project list');
  });

  it('空行の入力は何も表示せずプロンプトへ戻る', async () => {
    const { io } = await runRepl({
      services,
      inputs: ['', 'exit'],
      now: new Date(2026, 7, 12, 9, 0),
    });

    expect(io.outputs.filter((line) => line !== '')).toHaveLength(1);
  });
});
