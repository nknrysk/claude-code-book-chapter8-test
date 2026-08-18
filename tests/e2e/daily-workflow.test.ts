import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runRepl } from '../helpers/replHarness.js';
import { buildServices, type Services } from '../helpers/services.js';
import { useTempHome, type TempHome } from '../helpers/tempHome.js';

describe('1日の典型ワークフロー', () => {
  let home: TempHome;
  let services: Services;

  beforeEach(async () => {
    home = await useTempHome();
    services = buildServices();
  });

  afterEach(async () => {
    await home.cleanup();
  });

  it('切り替えを挟んだ 1 日の記録が show でタスク別に集計される', async () => {
    await runRepl({
      services,
      inputs: [
        'project add myproj',
        'use myproj',
        'task add 認証API実装',
        'task add 定例MTG',
        'start 認証API',
        'note リフレッシュトークンの設計も含む',
        'stop',
        'start 定例MTG',
        'stop',
        'exit',
      ],
      now: [
        new Date(2026, 7, 12, 9, 0), // project add
        new Date(2026, 7, 12, 9, 0),
        new Date(2026, 7, 12, 9, 1),
        new Date(2026, 7, 12, 9, 2),
        new Date(2026, 7, 12, 9, 12), // start 認証API
        new Date(2026, 7, 12, 9, 20),
        new Date(2026, 7, 12, 10, 17), // stop
        new Date(2026, 7, 12, 10, 30), // start 定例MTG
        new Date(2026, 7, 12, 11, 0), // stop
      ],
    });

    const { io } = await runRepl({
      services,
      inputs: ['use myproj', 'show', 'exit'],
      now: new Date(2026, 7, 12, 11, 5),
    });

    const text = io.text();
    expect(text).toContain('2026-08-12 の作業実績');
    expect(text).toContain('1:05(65分)');
    expect(text).toContain('0:30(30分)');
    expect(text).toContain('タスク別小計');
    expect(text).toContain('myproj / 認証API実装');
    expect(text).toContain('合計  1:35 (95分)');
    expect(text).toContain('リフレッシュトークンの設計も含む');
  });

  it('計測中の start は直前の計測を自動確定してから開始する', async () => {
    const { io } = await runRepl({
      services,
      inputs: [
        'project add myproj',
        'use myproj',
        'task add 認証API実装',
        'task add 定例MTG',
        'start 認証API',
        'start 定例MTG',
        'stop',
        'exit',
      ],
      now: [
        new Date(2026, 7, 12, 9, 0),
        new Date(2026, 7, 12, 9, 0),
        new Date(2026, 7, 12, 9, 1),
        new Date(2026, 7, 12, 9, 2),
        new Date(2026, 7, 12, 9, 12),
        new Date(2026, 7, 12, 10, 17),
        new Date(2026, 7, 12, 11, 0),
      ],
    });

    expect(io.text()).toContain('計測を終了しました: 認証API実装');
    expect(io.text()).toContain('計測を開始しました: 定例MTG');

    const stored = await services.entryStore.readDate('2026-08-12');
    expect(stored.entries.map((entry) => entry.minutes)).toEqual([65, 43]);
  });

  it('resume は直前のタスクを備考なしで再開する', async () => {
    const { io } = await runRepl({
      services,
      inputs: [
        'project add myproj',
        'use myproj',
        'task add 認証API実装',
        'start 1 引き継がれない備考',
        'stop',
        'resume',
        'exit',
      ],
      now: [
        new Date(2026, 7, 12, 9, 0),
        new Date(2026, 7, 12, 9, 0),
        new Date(2026, 7, 12, 9, 1),
        new Date(2026, 7, 12, 9, 12),
        new Date(2026, 7, 12, 10, 17),
        new Date(2026, 7, 12, 10, 30),
      ],
    });

    expect(io.text()).toContain('計測を開始しました: 認証API実装 (10:30)');
    const current = await services.currentStore.load();
    expect(current?.note).toBeUndefined();
  });

  it('タスク一覧は最近使った順に並び、番号指定と一致する', async () => {
    const { io } = await runRepl({
      services,
      inputs: [
        'project add myproj',
        'use myproj',
        'task add 認証API実装',
        'task add 定例MTG',
        'start 定例MTG',
        'stop',
        'task list',
        'start 1',
        'exit',
        'stop',
        'exit',
      ],
      now: [
        new Date(2026, 7, 12, 9, 0),
        new Date(2026, 7, 12, 9, 0),
        new Date(2026, 7, 12, 9, 1),
        new Date(2026, 7, 12, 9, 2),
        new Date(2026, 7, 12, 9, 12),
        new Date(2026, 7, 12, 9, 42),
        new Date(2026, 7, 12, 9, 45),
        new Date(2026, 7, 12, 9, 50),
      ],
    });

    const text = io.text();
    // 直前に計測した 定例MTG が 1 番になる
    expect(text).toContain('   1  定例MTG');
    expect(text).toContain('計測を開始しました: 定例MTG (09:50)');
  });

  it('日跨ぎの計測は 2 件に分割され、両日の show に現れる', async () => {
    await runRepl({
      services,
      inputs: [
        'project add myproj',
        'use myproj',
        'task add 深夜対応',
        'start 1',
        'stop',
        'exit',
      ],
      now: [
        new Date(2026, 7, 12, 9, 0),
        new Date(2026, 7, 12, 9, 0),
        new Date(2026, 7, 12, 9, 1),
        new Date(2026, 7, 12, 23, 30),
        new Date(2026, 7, 13, 0, 20),
      ],
    });

    const { io } = await runRepl({
      services,
      inputs: ['show 2026-08-12', 'show 2026-08-13', 'exit'],
      now: new Date(2026, 7, 13, 9, 0),
    });

    expect(io.text()).toContain('0:30(30分)');
    expect(io.text()).toContain('0:20(20分)');
  });

  it('エントリが無い日の show はエラーではなく案内を出す', async () => {
    const { io } = await runRepl({
      services,
      inputs: ['show 2026-01-01', 'exit'],
      now: new Date(2026, 7, 12, 9, 0),
    });

    expect(io.text()).toContain('2026-01-01 の作業実績はありません');
  });
});
