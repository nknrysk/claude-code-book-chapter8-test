import { appendFile, readFile } from 'node:fs/promises';
import { FILE_MODE } from '../types/constants.js';
import type { IsoDateTime, MonthKey } from '../types/ids.js';
import { ensureDataDir } from './ensureDataDir.js';
import { isNotFoundError } from './fsErrors.js';
import { recoveryLogPath } from './paths.js';

/**
 * 復帰処理の発動記録。作業内容(タスク名・備考・プロジェクト名)は一切含まない。
 *
 * architecture.md のログ非出力方針は「作業内容を含むため」を理由とするものであり、
 * タイムスタンプのみを持つこの記録が例外として成立するのはその一点による。
 * **将来もフィールドを増やさないこと。**
 */
export interface RecoveryEvent {
  at: IsoDateTime;
}

export class RecoveryLogStore {
  /** 起動時、current.json が存在し復帰フローに入った時点で 1 行追記する */
  async append(event: RecoveryEvent): Promise<void> {
    await ensureDataDir();
    await appendFile(recoveryLogPath(), `${JSON.stringify(event)}\n`, {
      mode: FILE_MODE,
      encoding: 'utf8',
    });
  }

  /** 月次集計用(KPI「復帰導線の発火率」)。指定月の発生回数を数える */
  async countInMonth(month: MonthKey): Promise<number> {
    let raw: string;
    try {
      raw = await readFile(recoveryLogPath(), 'utf8');
    } catch (error) {
      if (isNotFoundError(error)) return 0;
      throw error;
    }

    return raw
      .split('\n')
      .filter((line) => line.trim() !== '')
      .filter((line) => {
        const event = parseEvent(line);
        return event !== null && event.at.startsWith(`${month}-`);
      }).length;
  }
}

function parseEvent(line: string): RecoveryEvent | null {
  let raw: unknown;
  try {
    raw = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null) return null;
  const candidate = raw as Record<string, unknown>;
  return typeof candidate.at === 'string' ? { at: candidate.at } : null;
}
