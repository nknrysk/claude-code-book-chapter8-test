import type { AppError } from './errors.js';

/**
 * 想定内のエラーを制御フローとして扱うための型。
 * サービスレイヤーは例外を投げずにこの型を返し、
 * REPL レイヤーの switch にケース漏れがあれば型検査で落ちる。
 */
export type Result<T, E = AppError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

export const err = <E>(error: E): Result<never, E> => ({
  ok: false,
  error,
});
