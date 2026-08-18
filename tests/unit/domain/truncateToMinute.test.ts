import { describe, expect, it } from 'vitest';
import { truncateToMinute } from '../../../src/domain/truncateToMinute.js';

describe('truncateToMinute', () => {
  it('秒とミリ秒を切り捨てる', () => {
    const truncated = truncateToMinute(new Date(2026, 7, 12, 9, 12, 45, 678));

    expect(truncated.getSeconds()).toBe(0);
    expect(truncated.getMilliseconds()).toBe(0);
    expect(truncated.getMinutes()).toBe(12);
    expect(truncated.getHours()).toBe(9);
  });

  it('ちょうど 0 秒の入力は値が変わらない', () => {
    const source = new Date(2026, 7, 12, 9, 12, 0, 0);

    expect(truncateToMinute(source).getTime()).toBe(source.getTime());
  });

  it('引数の Date を破壊しない(純粋関数である)', () => {
    const source = new Date(2026, 7, 12, 9, 12, 45);

    truncateToMinute(source);

    expect(source.getSeconds()).toBe(45);
  });
});
