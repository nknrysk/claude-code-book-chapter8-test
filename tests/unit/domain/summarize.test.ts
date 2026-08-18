import { describe, expect, it } from 'vitest';
import {
  summarize,
  type ResolvedEntry,
} from '../../../src/domain/summarize.js';
import { makeEntry } from '../../helpers/fixtures.js';
import type { Entry } from '../../../src/types/entities.js';

function resolved(
  entry: Entry,
  names: {
    projectName?: string;
    taskName?: string;
    fromSnapshot?: boolean;
  } = {}
): ResolvedEntry {
  return {
    entry,
    projectName: names.projectName ?? entry.projectName,
    taskName: names.taskName ?? entry.taskName,
    resolvedFromSnapshot: names.fromSnapshot ?? false,
  };
}

describe('summarize', () => {
  it('開始時刻の昇順に整列し、1 始まりの行番号を付ける', () => {
    const later = makeEntry({
      start: '2026-08-12T10:30:00+09:00',
      end: '2026-08-12T11:00:00+09:00',
      minutes: 30,
      taskId: 't_mtg',
      taskName: '定例MTG',
    });
    const earlier = makeEntry();

    const report = summarize('2026-08-12', [
      resolved(later),
      resolved(earlier),
    ]);

    expect(report.rows.map((row) => row.lineNo)).toEqual([1, 2]);
    expect(report.rows[0].entry.start).toBe('2026-08-12T09:12:00+09:00');
    expect(report.rows[1].entry.taskName).toBe('定例MTG');
  });

  it('タスク別小計を合計時間の降順で返す', () => {
    const report = summarize('2026-08-12', [
      resolved(makeEntry()),
      resolved(
        makeEntry({
          start: '2026-08-12T10:30:00+09:00',
          minutes: 30,
          taskId: 't_mtg',
          taskName: '定例MTG',
        })
      ),
    ]);

    expect(report.subtotals).toEqual([
      { projectName: 'myproj', taskName: '認証API実装', minutes: 65 },
      { projectName: 'myproj', taskName: '定例MTG', minutes: 30 },
    ]);
  });

  it('同一タスクの複数エントリを 1 行に合算する', () => {
    const report = summarize('2026-08-12', [
      resolved(makeEntry({ minutes: 65 })),
      resolved(makeEntry({ start: '2026-08-12T13:00:00+09:00', minutes: 35 })),
    ]);

    expect(report.subtotals).toHaveLength(1);
    expect(report.subtotals[0].minutes).toBe(100);
  });

  it('小計は名前ではなく ID で束ねる(リネーム前後で行が割れない)', () => {
    const renamed = makeEntry({ taskName: '旧タスク名' });
    const current = makeEntry({
      start: '2026-08-12T13:00:00+09:00',
      minutes: 35,
      taskName: '新タスク名',
    });

    const report = summarize('2026-08-12', [
      resolved(renamed, { taskName: '新タスク名' }),
      resolved(current, { taskName: '新タスク名' }),
    ]);

    expect(report.subtotals).toHaveLength(1);
    expect(report.subtotals[0].minutes).toBe(100);
  });

  it('プロジェクトが異なれば別の小計になる', () => {
    const report = summarize('2026-08-12', [
      resolved(makeEntry()),
      resolved(
        makeEntry({
          projectId: 'p_other',
          projectName: 'otherproj',
          start: '2026-08-12T13:00:00+09:00',
          minutes: 20,
        })
      ),
    ]);

    expect(report.subtotals).toHaveLength(2);
  });

  it('合計時間を算出する', () => {
    const report = summarize('2026-08-12', [
      resolved(makeEntry({ minutes: 65 })),
      resolved(makeEntry({ start: '2026-08-12T10:30:00+09:00', minutes: 30 })),
    ]);

    expect(report.totalMinutes).toBe(95);
  });

  it('エントリが 0 件でも空のレポートを返す(エラーにしない)', () => {
    const report = summarize('2026-08-12', []);

    expect(report).toEqual({
      date: '2026-08-12',
      rows: [],
      subtotals: [],
      totalMinutes: 0,
    });
  });

  it('フォールバックした行はスナップショット由来であることを保持する', () => {
    const report = summarize('2026-08-12', [
      resolved(makeEntry(), { fromSnapshot: true }),
    ]);

    expect(report.rows[0].resolvedFromSnapshot).toBe(true);
  });
});
