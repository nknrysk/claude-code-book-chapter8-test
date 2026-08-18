import type { Task } from '../types/entities.js';

/**
 * 「最近使った順」の比較関数。task list の表示順と start <番号> の解決順は
 * この 1 つの規則から導かれる(両者がずれると誤ったタスクを計測してしまう)。
 *
 * 1. lastUsedAt の降順(未使用は最後)
 * 2. 同値なら createdAt の降順(新しいものを手前に)
 */
export function byRecency(a: Task, b: Task): number {
  if (a.lastUsedAt !== b.lastUsedAt) {
    if (a.lastUsedAt === null) return 1;
    if (b.lastUsedAt === null) return -1;
    return b.lastUsedAt.localeCompare(a.lastUsedAt);
  }
  return b.createdAt.localeCompare(a.createdAt);
}
