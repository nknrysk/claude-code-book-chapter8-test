import type { IsoDateTime } from '../types/ids.js';

/**
 * Date をローカルタイムゾーンのオフセット付き ISO 8601 (秒精度) に変換する。
 *
 * Date#toISOString() は UTC の "Z" 形式を返すため使えない。記録されたエントリを
 * grep や表計算で読む際、記録時の現地時刻がそのまま読めることに価値がある。
 *
 * @param d - 変換対象の日時
 * @returns 例: "2026-08-12T09:12:00+09:00"
 */
export function formatIsoLocal(d: Date): IsoDateTime {
  const yyyy = String(d.getFullYear()).padStart(4, '0');
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const mi = pad2(d.getMinutes());
  const ss = pad2(d.getSeconds());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}${formatOffset(d)}`;
}

/** getTimezoneOffset() は UTC からの差を分で「西が正」で返すため符号を反転する */
function formatOffset(d: Date): string {
  const offsetMinutes = -d.getTimezoneOffset();
  const sign = offsetMinutes < 0 ? '-' : '+';
  const abs = Math.abs(offsetMinutes);
  return `${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}
