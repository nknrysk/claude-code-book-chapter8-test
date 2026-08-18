import { describe, expect, it } from 'vitest';
import { generateId } from '../../../src/domain/generateId.js';
import { ID_ALPHABET } from '../../../src/types/constants.js';

/** 決定的な乱数源。呼び出しごとに固定バイト列を返す */
function fixedRandom(...sequences: number[][]) {
  let call = 0;
  return (size: number): Uint8Array => {
    const source = sequences[Math.min(call, sequences.length - 1)];
    call += 1;
    return Uint8Array.from(source.slice(0, size));
  };
}

describe('generateId', () => {
  it('プレフィックス + Crockford Base32 6 文字の ID を生成する', () => {
    const generated = generateId(
      'p',
      new Set(),
      fixedRandom([0, 1, 2, 3, 4, 5])
    );

    expect(generated).toBe('p_012345');
    expect(generated).toMatch(/^p_[0-9a-z]{6}$/);
  });

  it('タスクは t_ 始まりになる(数字始まりにしない)', () => {
    const generated = generateId(
      't',
      new Set(),
      fixedRandom([9, 9, 9, 9, 9, 9])
    );

    expect(generated.startsWith('t_')).toBe(true);
  });

  it('Crockford Base32 の文字集合のみを使う(i, l, o, u を含まない)', () => {
    const generated = generateId(
      'p',
      new Set(),
      fixedRandom([31, 30, 29, 28, 27, 26])
    );

    const body = generated.slice(2);
    expect([...body].every((char) => ID_ALPHABET.includes(char))).toBe(true);
    expect(body).not.toMatch(/[ilou]/);
  });

  it('既存IDと衝突した場合は再生成する', () => {
    const generated = generateId(
      'p',
      new Set(['p_012345']),
      fixedRandom([0, 1, 2, 3, 4, 5], [5, 4, 3, 2, 1, 0])
    );

    expect(generated).toBe('p_543210');
  });

  it('バイト値は文字集合の長さで剰余を取る', () => {
    const generated = generateId(
      'p',
      new Set(),
      fixedRandom([32, 33, 34, 35, 36, 37])
    );

    expect(generated).toBe('p_012345');
  });

  it('リトライ上限を超えても衝突し続ける場合は例外を投げる', () => {
    const existing = new Set(['p_012345']);

    expect(() =>
      generateId('p', existing, fixedRandom([0, 1, 2, 3, 4, 5]))
    ).toThrow('ID の採番に失敗しました');
  });
});
