import { writeFile } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { currentPath } from '../../src/stores/paths.js';
import { runRepl } from '../helpers/replHarness.js';
import {
  buildServices,
  seedProjectWithTask,
  type Services,
} from '../helpers/services.js';
import { useTempHome, type TempHome } from '../helpers/tempHome.js';

describe('終了フローと異常終了からの復帰', () => {
  let home: TempHome;
  let services: Services;

  beforeEach(async () => {
    home = await useTempHome();
    services = buildServices();
  });

  afterEach(async () => {
    await home.cleanup();
  });

  it('計測中の exit は終了を中止して stop を促す', async () => {
    await seedProjectWithTask(services);

    // 起動時に計測中だと復帰フローが入力を消費するため、セッション内で計測を開始する
    const { io } = await runRepl({
      services,
      inputs: ['use myproj', 'start 1', 'exit', 'stop', 'exit'],
      now: [
        new Date(2026, 7, 12, 9, 10),
        new Date(2026, 7, 12, 9, 12),
        new Date(2026, 7, 12, 10, 0),
        new Date(2026, 7, 12, 10, 17),
        new Date(2026, 7, 12, 10, 18),
      ],
    });

    expect(io.text()).toContain(
      "認証API実装 を計測中です。'stop' で終了してから exit してください"
    );
    expect(io.text()).toContain('計測を終了しました');
    expect(await services.currentStore.load()).toBeNull();
  });

  it('計測していなければ exit は正常に終了する', async () => {
    const { io } = await runRepl({
      services,
      inputs: ['exit'],
      now: new Date(2026, 7, 12, 10, 0),
    });

    expect(io.text()).not.toContain('計測中です');
  });

  it('起動時に計測中の状態があれば終了時刻を尋ねて確定する', async () => {
    const { projectId, taskId } = await seedProjectWithTask(services);
    await services.timerService.start(
      projectId,
      taskId,
      undefined,
      new Date(2026, 7, 11, 18, 0)
    );

    const { io } = await runRepl({
      services,
      inputs: ['2026-08-11 19:30', 'exit'],
      now: new Date(2026, 7, 12, 9, 2),
    });

    expect(io.text()).toContain('計測中のまま終了していました: 認証API実装');
    expect(io.text()).toContain('計測を終了しました');

    const stored = await services.entryStore.readDate('2026-08-11');
    expect(stored.entries).toHaveLength(1);
    expect(stored.entries[0].minutes).toBe(90);
    expect(await services.currentStore.load()).toBeNull();
  });

  it('HH:MM だけの入力は開始日の日付で解釈される', async () => {
    const { projectId, taskId } = await seedProjectWithTask(services);
    await services.timerService.start(
      projectId,
      taskId,
      undefined,
      new Date(2026, 7, 11, 18, 0)
    );

    await runRepl({
      services,
      inputs: ['19:30', 'exit'],
      now: new Date(2026, 7, 12, 9, 2),
    });

    const stored = await services.entryStore.readDate('2026-08-11');
    expect(stored.entries[0].minutes).toBe(90);
  });

  it('開始時刻より前の終了時刻は再入力を求める', async () => {
    const { projectId, taskId } = await seedProjectWithTask(services);
    await services.timerService.start(
      projectId,
      taskId,
      undefined,
      new Date(2026, 7, 11, 18, 0)
    );

    const { io } = await runRepl({
      services,
      inputs: ['17:00', '19:30', 'exit'],
      now: new Date(2026, 7, 12, 9, 2),
    });

    expect(io.text()).toContain('より前です');
    expect(
      (await services.entryStore.readDate('2026-08-11')).entries
    ).toHaveLength(1);
  });

  it('形式が不正な入力は再入力を求める', async () => {
    const { projectId, taskId } = await seedProjectWithTask(services);
    await services.timerService.start(
      projectId,
      taskId,
      undefined,
      new Date(2026, 7, 11, 18, 0)
    );

    const { io } = await runRepl({
      services,
      inputs: ['1930', '19:30', 'exit'],
      now: new Date(2026, 7, 12, 9, 2),
    });

    expect(io.text()).toContain('形式が不正です');
  });

  it('空入力で保留した場合は current.json を保持したまま起動する', async () => {
    const { projectId, taskId } = await seedProjectWithTask(services);
    await services.timerService.start(
      projectId,
      taskId,
      undefined,
      new Date(2026, 7, 11, 18, 0)
    );

    const { io } = await runRepl({
      services,
      inputs: ['', 'exit', 'stop', 'exit'],
      now: new Date(2026, 7, 12, 9, 2),
    });

    expect(io.text()).toContain('復帰を保留しました');
    expect(io.text()).toContain('計測中です');
  });

  it('復帰フローに入ると recovery.jsonl に 1 件記録される(発火率の測定)', async () => {
    const { projectId, taskId } = await seedProjectWithTask(services);
    await services.timerService.start(
      projectId,
      taskId,
      undefined,
      new Date(2026, 7, 11, 18, 0)
    );

    await runRepl({
      services,
      inputs: ['19:30', 'exit'],
      now: new Date(2026, 7, 12, 9, 2),
    });

    expect(await services.recoveryLogStore.countInMonth('2026-08')).toBe(1);
  });

  it('保留(中断)した場合も発火として 1 件記録される', async () => {
    const { projectId, taskId } = await seedProjectWithTask(services);
    await services.timerService.start(
      projectId,
      taskId,
      undefined,
      new Date(2026, 7, 11, 18, 0)
    );

    await runRepl({
      services,
      inputs: ['', 'exit', 'stop', 'exit'],
      now: new Date(2026, 7, 12, 9, 2),
    });

    expect(await services.recoveryLogStore.countInMonth('2026-08')).toBe(1);
  });

  it('current.json が破損している場合は内容を示して破棄を確認する', async () => {
    await seedProjectWithTask(services);
    await writeFile(currentPath(), '{壊れた', { mode: 0o600 });

    const { io } = await runRepl({
      services,
      inputs: ['y', 'exit'],
      now: new Date(2026, 7, 12, 9, 2),
    });

    expect(io.text()).toContain('が破損しています');
    expect(io.text()).toContain('内容: {壊れた');
    expect(io.text()).toContain('current.json を破棄しました');
    expect(await services.currentStore.load()).toBeNull();
  });

  it('破棄しない選択なら current.json を保持したまま起動する', async () => {
    await seedProjectWithTask(services);
    await writeFile(currentPath(), '{壊れた', { mode: 0o600 });

    const { io } = await runRepl({
      services,
      inputs: ['n', 'exit'],
      now: new Date(2026, 7, 12, 9, 2),
    });

    expect(io.text()).toContain('current.json を保持したまま起動します');
    await expect(services.currentStore.load()).rejects.toThrow();
  });
});
