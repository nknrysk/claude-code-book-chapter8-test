import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CurrentStore } from '../../src/stores/CurrentStore.js';
import {
  buildServices,
  seedProjectWithTask,
  type Services,
} from '../helpers/services.js';
import { useTempHome, type TempHome } from '../helpers/tempHome.js';

describe('計測のライフサイクル', () => {
  let home: TempHome;
  let services: Services;
  let projectId: string;
  let taskId: string;

  beforeEach(async () => {
    home = await useTempHome();
    services = buildServices();
    ({ projectId, taskId } = await seedProjectWithTask(services));
  });

  afterEach(async () => {
    await home.cleanup();
  });

  it('start で current.json が即座に書き込まれる', async () => {
    const started = await services.timerService.start(
      projectId,
      taskId,
      'JWT の検証まわり',
      new Date(2026, 7, 12, 9, 12)
    );

    expect(started.ok).toBe(true);
    const current = await new CurrentStore().load();
    expect(current).toMatchObject({
      projectId,
      projectName: 'myproj',
      taskId,
      taskName: '認証API実装',
      note: 'JWT の検証まわり',
    });
  });

  it('stop でエントリが追記され、current.json が削除される', async () => {
    await services.timerService.start(
      projectId,
      taskId,
      undefined,
      new Date(2026, 7, 12, 9, 12)
    );

    const stopped = await services.timerService.stop(
      new Date(2026, 7, 12, 10, 17)
    );

    expect(stopped.ok).toBe(true);
    if (!stopped.ok) return;
    expect(stopped.value).toHaveLength(1);
    expect(stopped.value[0].minutes).toBe(65);
    expect(await services.currentStore.load()).toBeNull();

    const stored = await services.entryStore.readDate('2026-08-12');
    expect(stored.entries).toHaveLength(1);
    expect(stored.entries[0]).toMatchObject({
      projectId,
      projectName: 'myproj',
      taskId,
      taskName: '認証API実装',
      minutes: 65,
      source: 'realtime',
    });
  });

  it('計測していない状態の stop は状態を変えずに NotMeasuring を返す', async () => {
    const stopped = await services.timerService.stop(new Date(2026, 7, 12, 10));

    expect(stopped).toEqual({ ok: false, error: { kind: 'NotMeasuring' } });
    expect((await services.entryStore.readDate('2026-08-12')).entries).toEqual(
      []
    );
  });

  it('計測中の start は直前の計測を自動確定してから開始する', async () => {
    const other = await services.projectService.addTask(
      projectId,
      '定例MTG',
      new Date(2026, 7, 1, 9, 0)
    );
    if (!other.ok) throw new Error('タスクの登録に失敗しました');

    await services.timerService.start(
      projectId,
      taskId,
      undefined,
      new Date(2026, 7, 12, 9, 0)
    );
    const restarted = await services.timerService.start(
      projectId,
      other.value.id,
      undefined,
      new Date(2026, 7, 12, 10, 0)
    );

    expect(restarted.ok).toBe(true);
    if (!restarted.ok) return;
    expect(restarted.value.autoStopped).toHaveLength(1);
    expect(restarted.value.autoStopped?.[0].minutes).toBe(60);

    const current = await services.currentStore.load();
    expect(current?.taskName).toBe('定例MTG');
  });

  it('note は計測中エントリの備考を上書きし、確定時にエントリへ載る', async () => {
    await services.timerService.start(
      projectId,
      taskId,
      '最初の備考',
      new Date(2026, 7, 12, 9, 0)
    );

    await services.timerService.setNote('上書きした備考');
    const stopped = await services.timerService.stop(
      new Date(2026, 7, 12, 9, 30)
    );

    expect(stopped.ok).toBe(true);
    if (!stopped.ok) return;
    expect(stopped.value[0].note).toBe('上書きした備考');
  });

  it('計測していない状態の note は NotMeasuring を返す', async () => {
    expect(await services.timerService.setNote('x')).toEqual({
      ok: false,
      error: { kind: 'NotMeasuring' },
    });
  });

  it('resume は直前に確定したエントリと同じタスクで開始し、備考を引き継がない', async () => {
    await services.timerService.start(
      projectId,
      taskId,
      '引き継がれない備考',
      new Date(2026, 7, 12, 9, 0)
    );
    await services.timerService.stop(new Date(2026, 7, 12, 9, 30));

    const resumed = await services.timerService.resume(
      new Date(2026, 7, 12, 10, 0)
    );

    expect(resumed.ok).toBe(true);
    if (!resumed.ok) return;
    expect(resumed.value.started.taskId).toBe(taskId);
    expect(resumed.value.started.note).toBeUndefined();
  });

  it('確定エントリが 1 件も無い状態の resume は NoResumeTarget を返す', async () => {
    expect(
      await services.timerService.resume(new Date(2026, 7, 12, 10))
    ).toEqual({ ok: false, error: { kind: 'NoResumeTarget' } });
  });

  it('start が lastUsedAt を更新し、タスクの並び順が最近使った順になる', async () => {
    const other = await services.projectService.addTask(
      projectId,
      '定例MTG',
      new Date(2026, 7, 1, 9, 0)
    );
    if (!other.ok) throw new Error('タスクの登録に失敗しました');

    await services.timerService.start(
      projectId,
      taskId,
      undefined,
      new Date(2026, 7, 12, 9, 0)
    );
    await services.timerService.stop(new Date(2026, 7, 12, 9, 30));

    const tasks = await services.projectService.listTasks(projectId, false);
    expect(tasks[0].id).toBe(taskId);
  });

  it('1 分未満の計測も 0 分のエントリとして記録する(破棄しない)', async () => {
    await services.timerService.start(
      projectId,
      taskId,
      undefined,
      new Date(2026, 7, 12, 9, 0, 10)
    );
    const stopped = await services.timerService.stop(
      new Date(2026, 7, 12, 9, 0, 50)
    );

    expect(stopped.ok).toBe(true);
    if (!stopped.ok) return;
    expect(stopped.value[0].minutes).toBe(0);
    expect(
      (await services.entryStore.readDate('2026-08-12')).entries
    ).toHaveLength(1);
  });

  it('finalizeRecovered は指定した終了時刻で確定する', async () => {
    await services.timerService.start(
      projectId,
      taskId,
      undefined,
      new Date(2026, 7, 11, 18, 0)
    );

    const finalized = await services.timerService.finalizeRecovered(
      new Date(2026, 7, 11, 19, 30)
    );

    expect(finalized.ok).toBe(true);
    if (!finalized.ok) return;
    expect(finalized.value[0].minutes).toBe(90);
    expect(await services.currentStore.load()).toBeNull();
  });

  it('finalizeRecovered は開始より前の終了時刻を InvalidTimeRange として拒否する', async () => {
    await services.timerService.start(
      projectId,
      taskId,
      undefined,
      new Date(2026, 7, 11, 18, 0)
    );

    const finalized = await services.timerService.finalizeRecovered(
      new Date(2026, 7, 11, 17, 0)
    );

    expect(finalized.ok).toBe(false);
    if (finalized.ok) return;
    expect(finalized.error.kind).toBe('InvalidTimeRange');
    // 記録を失わないよう current.json は保持する
    expect(await services.currentStore.load()).not.toBeNull();
  });

  it('別プロセスが開始した計測を確定する場合に警告を返す(多重起動の検知)', async () => {
    // 自プロセスの記憶を持たない別インスタンスが書いた current.json を模す
    const foreign = buildServices();
    await foreign.timerService.start(
      projectId,
      taskId,
      undefined,
      new Date(2026, 7, 12, 9, 0)
    );

    const started = await services.timerService.start(
      projectId,
      taskId,
      undefined,
      new Date(2026, 7, 12, 10, 0)
    );

    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(started.value.warnings[0]).toContain('多重起動');
  });

  it('同一プロセス内の start では多重起動の警告を出さない', async () => {
    await services.timerService.start(
      projectId,
      taskId,
      undefined,
      new Date(2026, 7, 12, 9, 0)
    );
    const started = await services.timerService.start(
      projectId,
      taskId,
      undefined,
      new Date(2026, 7, 12, 10, 0)
    );

    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(started.value.warnings).toEqual([]);
  });
});
