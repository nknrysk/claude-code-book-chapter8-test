import { appendFile, readdir, readFile } from 'node:fs/promises';
import { FILE_MODE } from '../types/constants.js';
import type { Entry } from '../types/entities.js';
import type { DateString, MonthKey } from '../types/ids.js';
import { ensureDataDir } from './ensureDataDir.js';
import { isNotFoundError } from './fsErrors.js';
import { entriesDir, entryPath } from './paths.js';

export interface ReadResult {
  entries: Entry[];
  /** 破損行のスキップなど、呼び出し側が表示する警告 */
  warnings: string[];
}

const MONTH_FILE = /^(\d{4}-\d{2})\.jsonl$/;

/**
 * entries/YYYY-MM.jsonl の読み書き。
 *
 * 業務ルール(日跨ぎ分割・集計・並び替え・名前解決)は持たない。
 * append は「渡されたエントリを月ごとに振り分けて追記する」だけであり、
 * なぜ複数件になっているかを知らない。
 */
export class EntryStore {
  /** 該当月を読み込む。破損行はスキップし、警告を warnings に積む */
  async readMonth(month: MonthKey): Promise<ReadResult> {
    let raw: string;
    try {
      raw = await readFile(entryPath(month), 'utf8');
    } catch (error) {
      if (isNotFoundError(error)) return { entries: [], warnings: [] };
      throw error;
    }

    const entries: Entry[] = [];
    const warnings: string[] = [];
    const lines = raw.split('\n');

    lines.forEach((line, index) => {
      if (line.trim() === '') return;
      const parsed = parseEntry(line);
      if (parsed === null) {
        // 1 行が壊れても他の行は読める。JSONL を選んだ理由がここにある
        warnings.push(
          `${month}.jsonl の ${index + 1} 行目を読み飛ばしました(不正なJSON)`
        );
        return;
      }
      entries.push(parsed);
    });

    return { entries, warnings };
  }

  /** 指定日のエントリのみを読み込む。月ファイルの読み込み対象は 1 つで済む */
  async readDate(date: DateString): Promise<ReadResult> {
    const { entries, warnings } = await this.readMonth(toMonth(date));
    return {
      entries: entries.filter((entry) => entry.date === date),
      warnings,
    };
  }

  /**
   * 最新の確定エントリを返す(resume 用)。
   * セッション状態ではなくファイルから解決するため、REPL 再起動直後でも resume が機能する。
   */
  async readLatest(): Promise<Entry | null> {
    const months = await this.listMonths();

    for (const month of months) {
      const { entries } = await this.readMonth(month);
      if (entries.length === 0) continue;
      return entries.reduce((latest, entry) =>
        entry.start.localeCompare(latest.start) >= 0 ? entry : latest
      );
    }
    return null;
  }

  /**
   * 複数エントリを月ごとに振り分けて追記する。
   *
   * 追記は既存の行に一切触れないため、途中で中断しても過去のエントリを破壊しない。
   * stop は最も頻度が高く、最も失ってはいけない操作である。
   */
  async append(entries: Entry[]): Promise<void> {
    if (entries.length === 0) return;
    await ensureDataDir();

    const byMonth = new Map<MonthKey, Entry[]>();
    for (const entry of entries) {
      const month = toMonth(entry.date);
      const bucket = byMonth.get(month);
      if (bucket === undefined) byMonth.set(month, [entry]);
      else bucket.push(entry);
    }

    for (const [month, monthEntries] of byMonth) {
      const content = monthEntries
        .map((entry) => `${JSON.stringify(entry)}\n`)
        .join('');
      await appendFile(entryPath(month), content, {
        mode: FILE_MODE,
        encoding: 'utf8',
      });
    }
  }

  /** 月ファイルを新しい順に列挙する */
  private async listMonths(): Promise<MonthKey[]> {
    let files: string[];
    try {
      files = await readdir(entriesDir());
    } catch (error) {
      if (isNotFoundError(error)) return [];
      throw error;
    }

    return files
      .map((file) => MONTH_FILE.exec(file)?.[1])
      .filter((month): month is MonthKey => month !== undefined)
      .sort((a, b) => b.localeCompare(a));
  }
}

function toMonth(date: DateString): MonthKey {
  return date.slice(0, 7);
}

/** 破損行はスキップする(呼び出し側が警告を出す) */
function parseEntry(line: string): Entry | null {
  let raw: unknown;
  try {
    raw = JSON.parse(line);
  } catch {
    return null;
  }
  return isEntry(raw) ? raw : null;
}

function isEntry(value: unknown): value is Entry {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.date === 'string' &&
    typeof candidate.start === 'string' &&
    typeof candidate.end === 'string' &&
    typeof candidate.minutes === 'number' &&
    typeof candidate.projectId === 'string' &&
    typeof candidate.projectName === 'string' &&
    typeof candidate.taskId === 'string' &&
    typeof candidate.taskName === 'string'
  );
}
