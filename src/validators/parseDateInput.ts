import type { DateString, MonthKey } from '../types/ids.js';
import { err, ok, type Result } from '../types/result.js';

/** 日付入力の形式エラー。AppError には含めない(validators 専用の型) */
export interface DateParseError {
  kind: 'InvalidDateFormat';
  input: string;
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH = /^(\d{4})-(\d{2})$/;

/** "YYYY-MM-DD" を検証する。実在しない日付は受け付けない */
export function parseDateInput(
  input: string
): Result<DateString, DateParseError> {
  const trimmed = input.trim();
  const matched = DATE.exec(trimmed);
  if (matched === null) {
    return err({ kind: 'InvalidDateFormat', input: trimmed });
  }

  const [, year, month, day] = matched.map(Number);
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return err({ kind: 'InvalidDateFormat', input: trimmed });
  }
  return ok(trimmed);
}

/** "YYYY-MM" を検証する(月ファイルの指定と export(P1) に使う) */
export function parseMonthInput(
  input: string
): Result<MonthKey, DateParseError> {
  const trimmed = input.trim();
  const matched = MONTH.exec(trimmed);
  if (matched === null) {
    return err({ kind: 'InvalidDateFormat', input: trimmed });
  }

  const month = Number(matched[2]);
  if (month < 1 || month > 12) {
    return err({ kind: 'InvalidDateFormat', input: trimmed });
  }
  return ok(trimmed);
}
