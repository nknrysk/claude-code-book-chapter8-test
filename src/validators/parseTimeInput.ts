import type { DateString } from '../types/ids.js';
import { err, ok, type Result } from '../types/result.js';

/**
 * 時刻入力の形式エラー。AppError ではなく専用の型とする。
 * AppError は「サービスレイヤーが Result で返す想定内エラー」に限定し、
 * 用語集の一覧と 1 対 1 の対応を保つため。
 */
export interface TimeParseError {
  kind: 'InvalidTimeFormat';
  input: string;
}

const TIME_ONLY = /^(\d{1,2}):(\d{2})$/;
const DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})$/;

/**
 * "HH:MM" または "YYYY-MM-DD HH:MM" をローカル時刻の Date に変換する。
 *
 * "HH:MM" のみの場合は baseDate の日付を補う。復帰フローでは
 * 「昨夜 18:00 に開始した計測を今朝閉じる」という入力があり得るため、
 * 日付を明示する形式も受け付ける。
 *
 * @param input - 入力文字列
 * @param baseDate - 日付が省略された場合に補う基準日
 */
export function parseTimeInput(
  input: string,
  baseDate: Date
): Result<Date, TimeParseError> {
  const trimmed = input.trim();

  const timeOnly = TIME_ONLY.exec(trimmed);
  if (timeOnly !== null) {
    const hours = Number(timeOnly[1]);
    const minutes = Number(timeOnly[2]);
    if (!isValidTime(hours, minutes)) {
      return err({ kind: 'InvalidTimeFormat', input: trimmed });
    }
    const parsed = new Date(baseDate);
    parsed.setHours(hours, minutes, 0, 0);
    return ok(parsed);
  }

  const dateTime = DATE_TIME.exec(trimmed);
  if (dateTime !== null) {
    const [, year, month, day, hours, minutes] = dateTime.map(Number);
    if (!isValidTime(hours, minutes)) {
      return err({ kind: 'InvalidTimeFormat', input: trimmed });
    }
    const parsed = new Date(year, month - 1, day, hours, minutes, 0, 0);
    // 実在しない日付(2026-02-31 等)は Date が繰り上げるため、往復させて検出する
    if (
      parsed.getFullYear() !== year ||
      parsed.getMonth() !== month - 1 ||
      parsed.getDate() !== day
    ) {
      return err({ kind: 'InvalidTimeFormat', input: trimmed });
    }
    return ok(parsed);
  }

  return err({ kind: 'InvalidTimeFormat', input: trimmed });
}

/** ローカル日付文字列から、その日の 0 時を指す Date を作る */
export function startOfDay(date: DateString): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function isValidTime(hours: number, minutes: number): boolean {
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}
