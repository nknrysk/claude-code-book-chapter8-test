import { describe, expect, it } from 'vitest';
import { buildEntries } from '../../../src/domain/buildEntries.js';
import { makeCurrentTimer } from '../../helpers/fixtures.js';

describe('buildEntries', () => {
  it('日跨ぎがなければ 1 件のエントリを生成する', () => {
    const entries = buildEntries(
      new Date(2026, 7, 12, 9, 12, 30),
      new Date(2026, 7, 12, 10, 17, 45),
      makeCurrentTimer()
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].date).toBe('2026-08-12');
    expect(entries[0].minutes).toBe(65);
    expect(entries[0].start).toContain('2026-08-12T09:12:00');
    expect(entries[0].end).toContain('2026-08-12T10:17:00');
  });

  it('秒を切り捨ててから分を算出する(丸めない)', () => {
    const entries = buildEntries(
      new Date(2026, 7, 12, 9, 0, 59),
      new Date(2026, 7, 12, 9, 1, 1),
      makeCurrentTimer()
    );

    expect(entries[0].minutes).toBe(1);
  });

  it('0 分の区間もエントリとして生成する(破棄しない)', () => {
    const entries = buildEntries(
      new Date(2026, 7, 12, 9, 0, 10),
      new Date(2026, 7, 12, 9, 0, 50),
      makeCurrentTimer()
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].minutes).toBe(0);
  });

  it('日跨ぎで分割し、合計が分割前と一致する', () => {
    const entries = buildEntries(
      new Date(2026, 7, 12, 23, 30),
      new Date(2026, 7, 13, 0, 20),
      makeCurrentTimer()
    );

    expect(entries.map((e) => e.minutes)).toEqual([30, 20]);
    expect(entries.map((e) => e.date)).toEqual(['2026-08-12', '2026-08-13']);
    expect(entries.reduce((sum, e) => sum + e.minutes, 0)).toBe(50);
  });

  it('3 日跨ぎでも合計が一致する', () => {
    const entries = buildEntries(
      new Date(2026, 7, 14, 18, 0),
      new Date(2026, 7, 17, 9, 0),
      makeCurrentTimer()
    );

    expect(entries).toHaveLength(4);
    expect(entries.reduce((sum, e) => sum + e.minutes, 0)).toBe(3780);
  });

  it('月跨ぎでも各エントリの日付が正しい', () => {
    const entries = buildEntries(
      new Date(2026, 7, 31, 23, 0),
      new Date(2026, 8, 1, 1, 0),
      makeCurrentTimer()
    );

    expect(entries.map((e) => e.date)).toEqual(['2026-08-31', '2026-09-01']);
  });

  it('ID と名前スナップショットの両方を書き込む', () => {
    const entries = buildEntries(
      new Date(2026, 7, 12, 9, 0),
      new Date(2026, 7, 12, 9, 30),
      makeCurrentTimer()
    );

    expect(entries[0]).toMatchObject({
      projectId: 'p_3x8q1v',
      projectName: 'myproj',
      taskId: 't_7h2k9m',
      taskName: '認証API実装',
    });
  });

  it('備考は分割された全エントリに複製される', () => {
    const entries = buildEntries(
      new Date(2026, 7, 12, 23, 30),
      new Date(2026, 7, 13, 0, 20),
      makeCurrentTimer({ note: 'JWT の検証まわり' })
    );

    expect(entries.every((e) => e.note === 'JWT の検証まわり')).toBe(true);
  });

  it('備考が未設定ならキー自体を持たない', () => {
    const entries = buildEntries(
      new Date(2026, 7, 12, 9, 0),
      new Date(2026, 7, 12, 9, 30),
      makeCurrentTimer()
    );

    expect('note' in entries[0]).toBe(false);
  });

  it('備考が空文字ならキーを持たない', () => {
    const entries = buildEntries(
      new Date(2026, 7, 12, 9, 0),
      new Date(2026, 7, 12, 9, 30),
      makeCurrentTimer({ note: '' })
    );

    expect('note' in entries[0]).toBe(false);
  });

  it('source は既定で realtime、指定すれば manual になる(P1 の add で再利用する)', () => {
    const timer = makeCurrentTimer();
    const realtime = buildEntries(
      new Date(2026, 7, 12, 9, 0),
      new Date(2026, 7, 12, 9, 30),
      timer
    );
    const manual = buildEntries(
      new Date(2026, 7, 12, 9, 0),
      new Date(2026, 7, 12, 9, 30),
      timer,
      'manual'
    );

    expect(realtime[0].source).toBe('realtime');
    expect(manual[0].source).toBe('manual');
  });
});
