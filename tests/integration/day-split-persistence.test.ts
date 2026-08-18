import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildServices,
  seedProjectWithTask,
  type Services,
} from '../helpers/services.js';
import { useTempHome, type TempHome } from '../helpers/tempHome.js';

describe('日跨ぎ・月跨ぎの永続化', () => {
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

  it('日付境界で分割し、合計時間が分割前と一致する', async () => {
    await services.timerService.start(
      projectId,
      taskId,
      undefined,
      new Date(2026, 7, 12, 23, 30)
    );
    const stopped = await services.timerService.stop(
      new Date(2026, 7, 13, 0, 20)
    );

    expect(stopped.ok).toBe(true);
    if (!stopped.ok) return;
    expect(stopped.value.map((entry) => entry.minutes)).toEqual([30, 20]);
    expect(stopped.value.reduce((sum, entry) => sum + entry.minutes, 0)).toBe(
      50
    );

    expect(
      (await services.entryStore.readDate('2026-08-12')).entries
    ).toHaveLength(1);
    expect(
      (await services.entryStore.readDate('2026-08-13')).entries
    ).toHaveLength(1);
  });

  it('月をまたぐ場合はそれぞれ該当する月のファイルへ書き込む', async () => {
    await services.timerService.start(
      projectId,
      taskId,
      undefined,
      new Date(2026, 7, 31, 23, 0)
    );
    await services.timerService.stop(new Date(2026, 8, 1, 1, 0));

    const august = await services.entryStore.readMonth('2026-08');
    const september = await services.entryStore.readMonth('2026-09');

    expect(august.entries).toHaveLength(1);
    expect(august.entries[0].minutes).toBe(60);
    expect(september.entries).toHaveLength(1);
    expect(september.entries[0].minutes).toBe(60);
  });

  it('3 日以上またぐ計測も上限なく分割される', async () => {
    await services.timerService.start(
      projectId,
      taskId,
      '週末をまたいだ計測',
      new Date(2026, 7, 14, 18, 0)
    );
    const stopped = await services.timerService.stop(
      new Date(2026, 7, 17, 9, 0)
    );

    expect(stopped.ok).toBe(true);
    if (!stopped.ok) return;
    expect(stopped.value).toHaveLength(4);
    expect(stopped.value.map((entry) => entry.date)).toEqual([
      '2026-08-14',
      '2026-08-15',
      '2026-08-16',
      '2026-08-17',
    ]);
    // 備考は分割された全エントリに複製される
    expect(
      stopped.value.every((entry) => entry.note === '週末をまたいだ計測')
    ).toBe(true);
  });

  it('分割されたエントリは追記され、既存の行を書き換えない', async () => {
    await services.timerService.start(
      projectId,
      taskId,
      undefined,
      new Date(2026, 7, 12, 9, 0)
    );
    await services.timerService.stop(new Date(2026, 7, 12, 10, 0));

    await services.timerService.start(
      projectId,
      taskId,
      undefined,
      new Date(2026, 7, 12, 23, 30)
    );
    await services.timerService.stop(new Date(2026, 7, 13, 0, 20));

    const august = await services.entryStore.readMonth('2026-08');
    expect(august.entries).toHaveLength(3);
    expect(august.warnings).toEqual([]);
  });

  it('readLatest は月をまたいでも最新の確定エントリを返す(resume の対象)', async () => {
    await services.timerService.start(
      projectId,
      taskId,
      undefined,
      new Date(2026, 7, 31, 23, 0)
    );
    await services.timerService.stop(new Date(2026, 8, 1, 1, 0));

    const latest = await services.entryStore.readLatest();

    expect(latest?.date).toBe('2026-09-01');
  });
});
