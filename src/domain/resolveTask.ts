import type { Task } from '../types/entities.js';
import { err, ok, type Result } from '../types/result.js';

export type ResolveError =
  | { kind: 'IndexOutOfRange'; input: string; max: number }
  | { kind: 'NotFound'; input: string }
  | { kind: 'Ambiguous'; input: string; candidates: Task[] };

const DIGITS_ONLY = /^\d+$/;

/**
 * 表示連番または名前の部分一致でタスクを解決する。
 *
 * 引数の tasks は「最近使った順に整列済みの非アーカイブタスク」であることを前提とする。
 * task list の表示と同じ配列を渡すことが、PRD の受け入れ条件
 * 「番号の並び順は task list の表示順と常に一致する」を構造的に満たす。
 *
 * 内部IDは t_ 始まりで数字始まりにならないため、将来 input.startsWith('t_') の分岐を
 * 先頭に足すだけで、既存の 2 分岐と衝突せずに拡張できる。
 *
 * @param tasks - 最近使った順の非アーカイブタスク(表示連番はこの配列の添字+1)
 * @param input - 数字のみなら表示連番、それ以外は名前の部分一致
 */
export function resolveTask(
  tasks: readonly Task[],
  input: string
): Result<Task, ResolveError> {
  const trimmed = input.trim();

  if (DIGITS_ONLY.test(trimmed)) {
    const index = Number(trimmed) - 1;
    if (index < 0 || index >= tasks.length) {
      return err({
        kind: 'IndexOutOfRange',
        input: trimmed,
        max: tasks.length,
      });
    }
    return ok(tasks[index]);
  }

  const matches = tasks.filter((task) => task.name.includes(trimmed));
  if (matches.length === 0) return err({ kind: 'NotFound', input: trimmed });
  if (matches.length > 1) {
    return err({ kind: 'Ambiguous', input: trimmed, candidates: matches });
  }
  return ok(matches[0]);
}
