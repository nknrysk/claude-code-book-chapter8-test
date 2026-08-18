import { describe, expect, it } from 'vitest';
import {
  formatDuration,
  formatElapsed,
} from '../../../src/formatters/formatDuration.js';

describe('formatDuration', () => {
  it.each([
    [0, '0:00(0分)'],
    [5, '0:05(5分)'],
    [65, '1:05(65分)'],
    [95, '1:35(95分)'],
    [1440, '24:00(1440分)'],
  ])('%i 分を H:MM(N分) で表す', (minutes, expected) => {
    expect(formatDuration(minutes)).toBe(expected);
  });

  it('spaced 指定で括弧の前に空白を入れる(タスク別小計の表示)', () => {
    expect(formatDuration(65, { spaced: true })).toBe('1:05 (65分)');
  });
});

describe('formatElapsed', () => {
  it.each([
    [0, '00:00'],
    [23, '00:23'],
    [65, '01:05'],
    [600, '10:00'],
  ])('%i 分を HH:MM で表す', (minutes, expected) => {
    expect(formatElapsed(minutes)).toBe(expected);
  });

  it('100 時間を超えても桁を伸ばして表示が崩れない', () => {
    expect(formatElapsed(6000)).toBe('100:00');
    expect(formatElapsed(6001)).toBe('100:01');
  });

  it('負の経過時間は 00:00 として扱う(時計のずれで負にならないようにする)', () => {
    expect(formatElapsed(-5)).toBe('00:00');
  });
});
