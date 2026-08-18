import {
  summarize,
  type DailyReport,
  type ResolvedEntry,
} from '../domain/summarize.js';
import type { EntryStore } from '../stores/EntryStore.js';
import type { DateString } from '../types/ids.js';
import type { NameResolver } from './NameResolver.js';

/** 破損行のスキップやスナップショットへのフォールバックを show が表示するために持つ */
export interface DailyReportResult {
  report: DailyReport;
  warnings: string[];
}

/** 指定日のエントリ取得、行番号付与、タスク別小計と合計の算出 */
export class ReportService {
  constructor(
    private readonly entryStore: EntryStore,
    private readonly nameResolver: NameResolver
  ) {}

  async daily(date: DateString): Promise<DailyReportResult> {
    const { entries, warnings } = await this.entryStore.readDate(date);

    const resolved: ResolvedEntry[] = [];
    for (const entry of entries) {
      const names = await this.nameResolver.resolve(entry);
      resolved.push({
        entry,
        projectName: names.projectName,
        taskName: names.taskName,
        resolvedFromSnapshot: names.fromSnapshot,
      });
    }

    const allWarnings = [...warnings];
    if (resolved.some((item) => item.resolvedFromSnapshot)) {
      allWarnings.push(
        '一部のエントリでプロジェクト/タスクが見つかりません。記録時の名前で表示しています'
      );
    }

    return { report: summarize(date, resolved), warnings: allWarnings };
  }
}
