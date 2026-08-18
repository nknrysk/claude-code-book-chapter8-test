import type { DateString } from '../types/ids.js';

/**
 * Date をローカル日付 "YYYY-MM-DD" に変換する。
 * UTC 基準の toISOString().slice(0, 10) では日付境界がずれるため自前で組み立てる。
 */
export function formatDate(d: Date): DateString {
  const yyyy = String(d.getFullYear()).padStart(4, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
