import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runRepl } from '../helpers/replHarness.js';
import { useTempHome, type TempHome } from '../helpers/tempHome.js';

describe('初回セットアップの最短経路', () => {
  let home: TempHome;

  beforeEach(async () => {
    home = await useTempHome();
  });

  afterEach(async () => {
    await home.cleanup();
  });

  it('登録から計測・確認までを 1 セッションで通せる', async () => {
    const { io, services } = await runRepl({
      inputs: [
        'project add myproj',
        'use myproj',
        'task add 認証API実装',
        'task list',
        'start 1 JWT の検証まわり',
        'stop',
        'show',
        'exit',
      ],
      now: new Date(2026, 7, 12, 9, 12),
    });

    const text = io.text();
    expect(text).toContain('プロジェクト myproj を登録しました');
    expect(text).toContain('プロジェクトを myproj に切り替えました');
    expect(text).toContain('タスク 認証API実装 を登録しました');
    expect(text).toContain('計測を開始しました: 認証API実装');
    expect(text).toContain('計測を終了しました');

    const stored = await services.entryStore.readDate('2026-08-12');
    expect(stored.entries).toHaveLength(1);
    expect(stored.entries[0]).toMatchObject({
      projectName: 'myproj',
      taskName: '認証API実装',
      note: 'JWT の検証まわり',
      source: 'realtime',
    });
  });

  it('起動直後のプロンプトはプロジェクト未選択を示す', async () => {
    const { io } = await runRepl({
      inputs: ['exit'],
      now: new Date(2026, 7, 12, 9, 0),
    });

    expect(io.prompts[0]).toBe('[未選択] > ');
  });

  it('プロジェクトもタスクも無い状態で一覧すると登録を案内する', async () => {
    const { io } = await runRepl({
      inputs: ['project list', 'exit'],
      now: new Date(2026, 7, 12, 9, 0),
    });

    expect(io.text()).toContain(
      "登録済みのプロジェクトがありません。'project add <名前>' で登録してください"
    );
  });
});
