import { NAME_MAX_LENGTH, NAME_MIN_LENGTH } from '../types/constants.js';
import type { AppError, NameTarget } from '../types/errors.js';
import { err, ok, type Result } from '../types/result.js';

/**
 * 制御文字。ANSI エスケープによる表示破壊を登録時点で防ぐ。
 * 制御文字の検出そのものが目的のため、no-control-regex を意図的に無効化する。
 */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

/**
 * プロジェクト名 / タスク名を検証し、前後の空白を落とした値を返す。
 *
 * 制御文字を登録時点で拒否するのは、ターミナルへそのまま出力される値だからである。
 * 保存後に落とす方式では、既存データに紛れ込んだ時点で表示が壊れる。
 *
 * @param name - 入力された名前
 * @param target - エラー文言を「プロジェクト名」「タスク名」で言い分けるための区別
 */
export function validateName(
  name: string,
  target: NameTarget
): Result<string, AppError> {
  const trimmed = name.trim();

  if (CONTROL_CHARACTERS.test(trimmed)) {
    return err({ kind: 'InvalidName', target, reason: 'control-character' });
  }
  if (trimmed.length < NAME_MIN_LENGTH || trimmed.length > NAME_MAX_LENGTH) {
    return err({ kind: 'InvalidName', target, reason: 'length' });
  }
  return ok(trimmed);
}
