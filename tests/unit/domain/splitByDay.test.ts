import { describe, expect, it } from 'vitest';
import { splitByDay } from '../../../src/domain/splitByDay.js';

const MS_PER_MINUTE = 60_000;

function totalMinutes(segments: { start: Date; end: Date }[]): number {
  return segments.reduce(
    (sum, s) => sum + (s.end.getTime() - s.start.getTime()) / MS_PER_MINUTE,
    0
  );
}

describe('splitByDay', () => {
  it('日跨ぎがなければ 1 セグメントを返す', () => {
    const start = new Date(2026, 7, 12, 9, 12);
    const end = new Date(2026, 7, 12, 10, 17);

    const segments = splitByDay(start, end);

    expect(segments).toHaveLength(1);
    expect(totalMinutes(segments)).toBe(65);
  });

  it('日付境界をまたぐと 2 セグメントに分割する', () => {
    const start = new Date(2026, 7, 12, 23, 30);
    const end = new Date(2026, 7, 13, 0, 20);

    const segments = splitByDay(start, end);

    expect(segments).toHaveLength(2);
    expect(segments[0].end.getHours()).toBe(0);
    expect(segments[0].end.getDate()).toBe(13);
    expect(segments[1].start.getTime()).toBe(segments[0].end.getTime());
    expect(totalMinutes(segments)).toBe(50);
  });

  it('3 日以上またぐ場合も上限なく分割する(金曜夜から月曜朝)', () => {
    const start = new Date(2026, 7, 14, 18, 0);
    const end = new Date(2026, 7, 17, 9, 0);

    const segments = splitByDay(start, end);

    expect(segments).toHaveLength(4);
    expect(
      segments.map((s) => (s.end.getTime() - s.start.getTime()) / MS_PER_MINUTE)
    ).toEqual([360, 1440, 1440, 540]);
    expect(totalMinutes(segments)).toBe(3780);
  });

  it('月をまたぐ場合も日付境界で分割する', () => {
    const start = new Date(2026, 7, 31, 23, 0);
    const end = new Date(2026, 8, 1, 1, 0);

    const segments = splitByDay(start, end);

    expect(segments).toHaveLength(2);
    expect(segments[0].start.getMonth()).toBe(7);
    expect(segments[1].start.getMonth()).toBe(8);
    expect(totalMinutes(segments)).toBe(120);
  });

  it('0 分(開始と終了が同じ)でも 1 セグメントを返す(破棄しない)', () => {
    const at = new Date(2026, 7, 12, 9, 0);

    const segments = splitByDay(at, at);

    expect(segments).toHaveLength(1);
    expect(totalMinutes(segments)).toBe(0);
  });

  it('ちょうど 0 時に終わる場合は余分なセグメントを作らない', () => {
    const start = new Date(2026, 7, 12, 23, 0);
    const end = new Date(2026, 7, 13, 0, 0);

    const segments = splitByDay(start, end);

    expect(segments).toHaveLength(1);
    expect(totalMinutes(segments)).toBe(60);
  });

  it('分割後の合計は常に分割前と一致する', () => {
    const start = new Date(2026, 7, 12, 8, 3);
    const end = new Date(2026, 7, 15, 17, 41);

    const segments = splitByDay(start, end);

    expect(totalMinutes(segments)).toBe(
      (end.getTime() - start.getTime()) / MS_PER_MINUTE
    );
  });
});
