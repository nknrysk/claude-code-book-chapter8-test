import { readFile, writeFile } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RecoveryLogStore } from '../../src/stores/RecoveryLogStore.js';
import { recoveryLogPath } from '../../src/stores/paths.js';
import { useTempHome, type TempHome } from '../helpers/tempHome.js';

describe('RecoveryLogStore', () => {
  let home: TempHome;
  let store: RecoveryLogStore;

  beforeEach(async () => {
    home = await useTempHome();
    store = new RecoveryLogStore();
  });

  afterEach(async () => {
    await home.cleanup();
  });

  it('発動時刻のみを 1 行ずつ追記する(作業内容を含まない)', async () => {
    await store.append({ at: '2026-08-13T09:02:00+09:00' });
    await store.append({ at: '2026-09-04T08:47:00+09:00' });

    const lines = (await readFile(recoveryLogPath(), 'utf8'))
      .split('\n')
      .filter((line) => line !== '');

    expect(lines).toEqual([
      '{"at":"2026-08-13T09:02:00+09:00"}',
      '{"at":"2026-09-04T08:47:00+09:00"}',
    ]);
    expect(lines.join('')).not.toContain('taskName');
  });

  it('指定月の発生回数を数える', async () => {
    await store.append({ at: '2026-08-13T09:02:00+09:00' });
    await store.append({ at: '2026-08-20T10:00:00+09:00' });
    await store.append({ at: '2026-09-04T08:47:00+09:00' });

    expect(await store.countInMonth('2026-08')).toBe(2);
    expect(await store.countInMonth('2026-09')).toBe(1);
  });

  it('月境界をまたぐ記録を取り違えない(2026-08 と 2026-08 以外)', async () => {
    await store.append({ at: '2026-08-01T00:00:00+09:00' });
    await store.append({ at: '2026-08-31T23:59:00+09:00' });
    await store.append({ at: '2026-07-31T23:59:00+09:00' });
    await store.append({ at: '2026-09-01T00:00:00+09:00' });

    expect(await store.countInMonth('2026-08')).toBe(2);
    expect(await store.countInMonth('2026-07')).toBe(1);
  });

  it('年が異なる同じ月を混同しない', async () => {
    await store.append({ at: '2025-08-13T09:02:00+09:00' });
    await store.append({ at: '2026-08-13T09:02:00+09:00' });

    expect(await store.countInMonth('2026-08')).toBe(1);
  });

  it('ファイルが存在しない場合は 0 を返す', async () => {
    expect(await store.countInMonth('2026-08')).toBe(0);
  });

  it('破損行は数えずに残りを数える', async () => {
    await store.append({ at: '2026-08-13T09:02:00+09:00' });
    await writeFile(
      recoveryLogPath(),
      '{"at":"2026-08-13T09:02:00+09:00"}\n{壊れた\n',
      {
        flag: 'w',
      }
    );

    expect(await store.countInMonth('2026-08')).toBe(1);
  });
});
