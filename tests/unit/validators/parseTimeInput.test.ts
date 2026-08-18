import { describe, expect, it } from 'vitest';
import {
  parseTimeInput,
  startOfDay,
} from '../../../src/validators/parseTimeInput.js';
import {
  parseDateInput,
  parseMonthInput,
} from '../../../src/validators/parseDateInput.js';

const BASE = new Date(2026, 7, 12, 15, 30, 45);

describe('parseTimeInput', () => {
  it('HH:MM を基準日の日付で解釈する', () => {
    const result = parseTimeInput('19:30', BASE);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.getFullYear()).toBe(2026);
    expect(result.value.getMonth()).toBe(7);
    expect(result.value.getDate()).toBe(12);
    expect(result.value.getHours()).toBe(19);
    expect(result.value.getMinutes()).toBe(30);
    expect(result.value.getSeconds()).toBe(0);
  });

  it('1 桁の時を受け付ける', () => {
    const result = parseTimeInput('9:05', BASE);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.getHours()).toBe(9);
  });

  it('YYYY-MM-DD HH:MM を日付ごと解釈する(前日の計測を閉じる場合)', () => {
    const result = parseTimeInput('2026-08-11 19:30', BASE);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.getDate()).toBe(11);
    expect(result.value.getHours()).toBe(19);
  });

  it('T 区切りも受け付ける', () => {
    expect(parseTimeInput('2026-08-11T19:30', BASE).ok).toBe(true);
  });

  it.each([
    ['形式違い', '1930'],
    ['秒付き', '19:30:00'],
    ['時が範囲外', '24:00'],
    ['分が範囲外', '19:60'],
    ['実在しない日付', '2026-02-31 10:00'],
    ['空文字', ''],
  ])('%s を InvalidTimeFormat として拒否する', (_label, input) => {
    const result = parseTimeInput(input, BASE);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('InvalidTimeFormat');
  });
});

describe('startOfDay', () => {
  it('日付文字列からその日の 0 時を作る', () => {
    const d = startOfDay('2026-08-12');

    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7);
    expect(d.getDate()).toBe(12);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });
});

describe('parseDateInput', () => {
  it('YYYY-MM-DD を受け付ける', () => {
    expect(parseDateInput('2026-08-12')).toEqual({
      ok: true,
      value: '2026-08-12',
    });
  });

  it.each([['2026-8-12'], ['20260812'], ['2026-02-30'], ['']])(
    '%s を拒否する',
    (input) => {
      expect(parseDateInput(input).ok).toBe(false);
    }
  );
});

describe('parseMonthInput', () => {
  it('YYYY-MM を受け付ける', () => {
    expect(parseMonthInput('2026-08')).toEqual({
      ok: true,
      value: '2026-08',
    });
  });

  it.each([['2026-13'], ['2026-00'], ['2026'], ['2026-08-12']])(
    '%s を拒否する',
    (input) => {
      expect(parseMonthInput(input).ok).toBe(false);
    }
  );
});
