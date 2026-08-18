import { MINUTES_PER_HOUR } from '../types/constants.js';

/**
 * 作業時間を "H:MM(N分)" 形式に整形する。
 *
 * 2 つの表現を併記するのは PRD の受け入れ条件による。H:MM は感覚的な把握に、
 * N分 は表計算への転記に使われる。
 *
 * @param minutes - 作業時間(分)
 * @param options.spaced - 括弧の前に空白を入れる(タスク別小計の表示で使用)
 */
export function formatDuration(
  minutes: number,
  options: { spaced?: boolean } = {}
): string {
  const separator = options.spaced ? ' ' : '';
  return `${formatHm(minutes)}${separator}(${minutes}分)`;
}

/**
 * 経過時間を "HH:MM" 形式に整形する。プロンプト表示に使う。
 * 100 時間を超える場合は時の桁が伸びる(例: "100:00")。
 */
export function formatElapsed(minutes: number): string {
  const safeMinutes = Math.max(0, minutes);
  const hours = Math.floor(safeMinutes / MINUTES_PER_HOUR);
  const rest = safeMinutes % MINUTES_PER_HOUR;
  return `${String(hours).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

/** "H:MM" 形式。時の桁は詰めない(例: "1:05") */
function formatHm(minutes: number): string {
  const safeMinutes = Math.max(0, minutes);
  const hours = Math.floor(safeMinutes / MINUTES_PER_HOUR);
  const rest = safeMinutes % MINUTES_PER_HOUR;
  return `${hours}:${String(rest).padStart(2, '0')}`;
}
