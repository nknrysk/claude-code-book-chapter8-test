import type { Entry } from '../types/entities.js';
import type { DateString } from '../types/ids.js';

/** 名前解決済みのエントリ。解決は I/O を伴うため、呼び出し側(ReportService)で済ませる */
export interface ResolvedEntry {
  entry: Entry;
  /** ID から解決した現在名 */
  projectName: string;
  /** ID から解決した現在名 */
  taskName: string;
  /** マスタが見つからずスナップショット名へフォールバックした場合 true */
  resolvedFromSnapshot: boolean;
}

export interface ReportRow extends ResolvedEntry {
  /** その日の中で 1 から始まる表示連番(P1 の edit の指定に使う) */
  lineNo: number;
}

export interface Subtotal {
  projectName: string;
  taskName: string;
  minutes: number;
}

export interface DailyReport {
  date: DateString;
  /** 開始時刻の昇順。lineNo は 1 始まり */
  rows: ReportRow[];
  /** プロジェクト+タスク単位。合計時間の降順 */
  subtotals: Subtotal[];
  totalMinutes: number;
}

/**
 * 日次集計を行う。行番号の付与、タスク別小計、合計時間を算出する。
 *
 * 副作用を持たないよう、名前解決は済ませたものを受け取る。
 *
 * @param date - 対象日
 * @param resolved - 名前解決済みのエントリ(順不同で構わない。本関数が整列する)
 */
export function summarize(
  date: DateString,
  resolved: readonly ResolvedEntry[]
): DailyReport {
  const rows: ReportRow[] = [...resolved]
    .sort((a, b) => a.entry.start.localeCompare(b.entry.start))
    .map((item, index) => ({ ...item, lineNo: index + 1 }));

  const subtotalByTask = new Map<string, Subtotal>();
  for (const row of rows) {
    // 名前ではなく ID で束ねる。リネーム前後のエントリや、スナップショットへ
    // フォールバックしたエントリが別行に割れるのを防ぐ
    const key = `${row.entry.projectId}:${row.entry.taskId}`;
    const found = subtotalByTask.get(key);
    if (found !== undefined) {
      found.minutes += row.entry.minutes;
    } else {
      subtotalByTask.set(key, {
        projectName: row.projectName,
        taskName: row.taskName,
        minutes: row.entry.minutes,
      });
    }
  }

  const subtotals = [...subtotalByTask.values()].sort(
    (a, b) => b.minutes - a.minutes
  );
  const totalMinutes = rows.reduce((sum, row) => sum + row.entry.minutes, 0);

  return { date, rows, subtotals, totalMinutes };
}
