import { describe, expect, it } from 'vitest';
import {
  displayWidth,
  padEndToWidth,
  padStartToWidth,
  truncateToWidth,
} from '../../../src/formatters/displayWidth.js';

describe('displayWidth', () => {
  it('半角を 1 桁として数える', () => {
    expect(displayWidth('abc12')).toBe(5);
  });

  it('全角を 2 桁として数える', () => {
    expect(displayWidth('認証API実装')).toBe(2 * 2 + 3 + 2 * 2);
  });

  it('空文字は 0 桁', () => {
    expect(displayWidth('')).toBe(0);
  });
});

describe('truncateToWidth', () => {
  it('収まる場合はそのまま返す', () => {
    expect(truncateToWidth('認証API', 10, '…')).toBe('認証API');
  });

  it('超える場合は記号の幅を含めて収まるところまで切り詰める', () => {
    const truncated = truncateToWidth('あいうえおかきくけこ', 10, '…');

    expect(truncated).toBe('あいうえ…');
    expect(displayWidth(truncated)).toBeLessThanOrEqual(10);
  });

  it('全角の途中で切らない(桁溢れを起こさない)', () => {
    const truncated = truncateToWidth('あいうえお', 5, '…');

    expect(displayWidth(truncated)).toBeLessThanOrEqual(5);
  });
});

describe('padEndToWidth / padStartToWidth', () => {
  it('表示幅を基準に右側を埋める', () => {
    expect(padEndToWidth('認証', 6)).toBe('認証  ');
  });

  it('表示幅を基準に左側を埋める', () => {
    expect(padStartToWidth('1', 3)).toBe('  1');
  });

  it('既に幅を超えている場合は埋めない', () => {
    expect(padEndToWidth('認証API実装', 3)).toBe('認証API実装');
  });
});
