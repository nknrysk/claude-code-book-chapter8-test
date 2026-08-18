import { formatDate } from '../formatters/formatDate.js';
import { formatIsoLocal } from '../formatters/formatIsoLocal.js';
import { MS_PER_MINUTE } from '../types/constants.js';
import type { CurrentTimer, Entry, EntrySource } from '../types/entities.js';
import { splitByDay } from './splitByDay.js';
import { truncateToMinute } from './truncateToMinute.js';

/**
 * 計測区間を日付境界で分割し、エントリ配列を生成する。
 *
 * 分割の前に開始・終了時刻を分単位へ切り捨てる。日付境界(00:00)は常に分の倍数のため、
 * 分単位に揃った区間を割る限り各セグメントは整数分となり、分割後の合計が分割前と厳密に一致する。
 * セグメントごとに独立して秒を切り捨てると、誤差がセグメント数だけ累積して合計が合わなくなる。
 *
 * 記録される start / end は秒精度のまま保持し、minutes の算出にのみ切り捨て後の値を使う。
 *
 * @param rawStart - 計測開始時刻(秒精度)
 * @param rawEnd - 計測終了時刻(秒精度)
 * @param timer - 計測中の状態。プロジェクト/タスクのIDと名前スナップショットを供給する
 * @param source - 作成経路。add(P1) は 'manual' を渡して再利用する
 * @returns 日付ごとに分割されたエントリ。日跨ぎがなければ 1 件
 */
export function buildEntries(
  rawStart: Date,
  rawEnd: Date,
  timer: CurrentTimer,
  source: EntrySource = 'realtime'
): Entry[] {
  const start = truncateToMinute(rawStart);
  const end = truncateToMinute(rawEnd);

  return splitByDay(start, end).map((segment) => ({
    date: formatDate(segment.start),
    start: formatIsoLocal(segment.start),
    end: formatIsoLocal(segment.end),
    minutes: (segment.end.getTime() - segment.start.getTime()) / MS_PER_MINUTE,
    projectId: timer.projectId,
    projectName: timer.projectName,
    taskId: timer.taskId,
    taskName: timer.taskName,
    // 分割は利用者が意図した行分けではないため、どのセグメントにも同じ備考を複製する
    ...(timer.note !== undefined && timer.note !== ''
      ? { note: timer.note }
      : {}),
    source,
  }));
}
