import { randomBytes } from 'node:crypto';
import {
  ID_ALPHABET,
  ID_BODY_LENGTH,
  ID_MAX_ATTEMPTS,
} from '../types/constants.js';

/** 乱数源。テストでは決定的な値を注入する */
export type RandomBytesFn = (size: number) => Uint8Array;

/**
 * プロジェクト / タスクの不変IDを採番する。
 *
 * Crockford Base32 を使うのは、i/l/1、o/0 の見間違いを避けるためである。
 * JSONL の直接閲覧など ID を目視で扱う場面がある。
 *
 * @param prefix - 'p'(プロジェクト) または 't'(タスク)。数字始まりを避け、
 *                 表示連番との解釈が衝突しないようにする
 * @param existing - 既存IDの集合。**アーカイブ済みを含む**全IDを渡す。
 *                   アーカイブしても過去エントリからの参照は生きており、ID の再利用は許されない
 * @param random - 乱数源(テスト用に差し替え可能)
 */
export function generateId(
  prefix: 'p' | 't',
  existing: ReadonlySet<string>,
  random: RandomBytesFn = randomBytes
): string {
  for (let attempt = 0; attempt < ID_MAX_ATTEMPTS; attempt += 1) {
    const bytes = random(ID_BODY_LENGTH);
    const body = Array.from(
      bytes,
      (byte) => ID_ALPHABET[byte % ID_ALPHABET.length]
    ).join('');
    const generated = `${prefix}_${body}`;
    if (!existing.has(generated)) return generated;
  }
  throw new Error('ID の採番に失敗しました');
}
