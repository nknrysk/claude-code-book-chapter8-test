import { describe, expect, it } from 'vitest';
import { formatIsoLocal } from '../../../src/formatters/formatIsoLocal.js';

/** 実行環境のタイムゾーンに依存しないよう、期待値も offset から組み立てる */
function expectedOffset(d: Date): string {
  const offsetMinutes = -d.getTimezoneOffset();
  const sign = offsetMinutes < 0 ? '-' : '+';
  const abs = Math.abs(offsetMinutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${sign}${hh}:${mm}`;
}

describe('formatIsoLocal', () => {
  it('ローカルタイムゾーンのオフセット付き ISO 8601 を秒精度で返す', () => {
    const d = new Date(2026, 7, 12, 9, 12, 0);

    expect(formatIsoLocal(d)).toBe(`2026-08-12T09:12:00${expectedOffset(d)}`);
  });

  it('月・日・時・分・秒を 2 桁に 0 埋めする', () => {
    const d = new Date(2026, 0, 3, 4, 5, 6);

    expect(formatIsoLocal(d)).toBe(`2026-01-03T04:05:06${expectedOffset(d)}`);
  });

  it('ミリ秒は出力しない(秒精度で切る)', () => {
    const d = new Date(2026, 7, 12, 23, 59, 59, 999);

    expect(formatIsoLocal(d)).toBe(`2026-08-12T23:59:59${expectedOffset(d)}`);
  });

  it('UTC の Z 形式ではなくオフセット表記になる', () => {
    const d = new Date(2026, 7, 12, 0, 0, 0);

    expect(formatIsoLocal(d)).not.toContain('Z');
    expect(formatIsoLocal(d)).toMatch(/[+-]\d{2}:\d{2}$/);
  });
});
