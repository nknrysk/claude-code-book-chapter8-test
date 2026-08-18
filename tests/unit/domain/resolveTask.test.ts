import { describe, expect, it } from 'vitest';
import { resolveTask } from '../../../src/domain/resolveTask.js';
import { makeTask } from '../../helpers/fixtures.js';

/** 「最近使った順」に整列済みの配列を渡す前提。表示連番は添字+1 */
const tasks = [
  makeTask({ id: 't_0000a1', name: '認証API実装' }),
  makeTask({ id: 't_0000b2', name: 'レビュー対応' }),
  makeTask({ id: 't_0000c3', name: 'API仕様レビュー' }),
];

describe('resolveTask', () => {
  it('数字のみの入力を表示連番として解釈する', () => {
    const result = resolveTask(tasks, '2');

    expect(result).toEqual({ ok: true, value: tasks[1] });
  });

  it('連番が範囲外なら IndexOutOfRange を返す', () => {
    const result = resolveTask(tasks, '99');

    expect(result).toEqual({
      ok: false,
      error: { kind: 'IndexOutOfRange', input: '99', max: 3 },
    });
  });

  it('連番 0 も範囲外として扱う(表示連番は 1 始まり)', () => {
    const result = resolveTask(tasks, '0');

    expect(result.ok).toBe(false);
  });

  it('部分一致が 1 件ならそのタスクを返す', () => {
    const result = resolveTask(tasks, '認証');

    expect(result).toEqual({ ok: true, value: tasks[0] });
  });

  it('部分一致が複数件なら候補付きの Ambiguous を返す', () => {
    const result = resolveTask(tasks, 'API');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('Ambiguous');
    if (result.error.kind !== 'Ambiguous') return;
    expect(result.error.candidates).toEqual([tasks[0], tasks[2]]);
  });

  it('部分一致が 0 件なら NotFound を返す', () => {
    const result = resolveTask(tasks, '存在しない');

    expect(result).toEqual({
      ok: false,
      error: { kind: 'NotFound', input: '存在しない' },
    });
  });

  it('タスクが 0 件の場合、連番指定は範囲外になる', () => {
    const result = resolveTask([], '1');

    expect(result).toEqual({
      ok: false,
      error: { kind: 'IndexOutOfRange', input: '1', max: 0 },
    });
  });

  it('前後の空白は無視する', () => {
    expect(resolveTask(tasks, '  2  ')).toEqual({ ok: true, value: tasks[1] });
  });
});
