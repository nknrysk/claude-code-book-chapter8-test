import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  CURRENT_FILE_NAME,
  DEFAULT_HOME_DIR_NAME,
  ENTRIES_DIR_NAME,
  PROJECTS_FILE_NAME,
  RECOVERY_LOG_FILE_NAME,
  TIMELOG_HOME_ENV,
} from '../types/constants.js';
import type { MonthKey } from '../types/ids.js';

/**
 * データディレクトリの位置を決める唯一の場所。
 *
 * 環境変数は呼び出しのたびに評価する。モジュール読み込み時に固定すると、
 * テストが一時ディレクトリを割り当てられなくなる。
 */
export function timelogHome(): string {
  const override = process.env[TIMELOG_HOME_ENV];
  if (override !== undefined && override !== '') return override;
  return join(homedir(), DEFAULT_HOME_DIR_NAME);
}

export function projectsPath(): string {
  return join(timelogHome(), PROJECTS_FILE_NAME);
}

export function currentPath(): string {
  return join(timelogHome(), CURRENT_FILE_NAME);
}

export function recoveryLogPath(): string {
  return join(timelogHome(), RECOVERY_LOG_FILE_NAME);
}

export function entriesDir(): string {
  return join(timelogHome(), ENTRIES_DIR_NAME);
}

export function entryPath(month: MonthKey): string {
  return join(entriesDir(), `${month}.jsonl`);
}
