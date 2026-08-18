import { describe, expect, it } from 'vitest';
import { validateName } from '../../../src/validators/validateName.js';

describe('validateName', () => {
  it('前後の空白を落とした名前を返す', () => {
    const result = validateName('  myproj  ', 'project');

    expect(result).toEqual({ ok: true, value: 'myproj' });
  });

  it.each([
    ['1文字', 'a'],
    ['100文字', 'a'.repeat(100)],
  ])('境界値 %s を受け付ける', (_label, name) => {
    expect(validateName(name, 'task').ok).toBe(true);
  });

  it.each([
    ['空文字', ''],
    ['空白のみ', '   '],
    ['101文字', 'a'.repeat(101)],
  ])('境界外 %s を length として拒否する', (_label, name) => {
    const result = validateName(name, 'task');

    expect(result).toEqual({
      ok: false,
      error: { kind: 'InvalidName', target: 'task', reason: 'length' },
    });
  });

  it('制御文字を含む名前を拒否する(ANSI エスケープによる表示破壊を防ぐ)', () => {
    const result = validateName(
      `myproj${String.fromCharCode(27)}[31m`,
      'project'
    );

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'InvalidName',
        target: 'project',
        reason: 'control-character',
      },
    });
  });

  it('DEL(0x7F) も制御文字として拒否する', () => {
    const result = validateName(`task${String.fromCharCode(127)}`, 'task');

    expect(result.ok).toBe(false);
  });

  it('日本語・記号を含む名前は受け付ける', () => {
    expect(validateName('認証API実装 (第2版)', 'task').ok).toBe(true);
  });
});
