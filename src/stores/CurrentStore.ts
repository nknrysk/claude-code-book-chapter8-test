import { readFile, unlink } from 'node:fs/promises';
import { CURRENT_FILE_VERSION, FILE_MODE } from '../types/constants.js';
import type { CurrentTimer } from '../types/entities.js';
import { DataCorruptedError } from '../types/errors.js';
import { atomicWrite } from './atomicWrite.js';
import { ensureDataDir } from './ensureDataDir.js';
import { isNotFoundError } from './fsErrors.js';
import { currentPath } from './paths.js';

/**
 * current.json の読み書き。ファイルの存在自体が「計測中である」ことを意味する。
 */
export class CurrentStore {
  /**
   * 計測中の状態を読み込む。存在しない場合は null(計測していない)。
   *
   * @throws DataCorruptedError パースに失敗した場合。呼び出し側は内容を提示して破棄を確認する
   */
  async load(): Promise<CurrentTimer | null> {
    let raw: string;
    try {
      raw = await readFile(currentPath(), 'utf8');
    } catch (error) {
      if (isNotFoundError(error)) return null;
      throw error;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new DataCorruptedError(
        'current.json のパースに失敗しました',
        currentPath(),
        raw
      );
    }

    if (!isCurrentTimer(parsed)) {
      throw new DataCorruptedError(
        'current.json の構造が不正です',
        currentPath(),
        raw
      );
    }
    return parsed;
  }

  /** 計測状態を保存する。start 時点で即座に呼ばれ、異常終了しても開始時刻を失わない */
  async save(timer: CurrentTimer): Promise<void> {
    await ensureDataDir();
    await atomicWrite(
      currentPath(),
      `${JSON.stringify(timer, null, 2)}\n`,
      FILE_MODE
    );
  }

  /** 計測状態を削除する。存在しない場合も成功として扱う */
  async clear(): Promise<void> {
    try {
      await unlink(currentPath());
    } catch (error) {
      if (!isNotFoundError(error)) throw error;
    }
  }
}

function isCurrentTimer(value: unknown): value is CurrentTimer {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.version === CURRENT_FILE_VERSION &&
    typeof candidate.projectId === 'string' &&
    typeof candidate.projectName === 'string' &&
    typeof candidate.taskId === 'string' &&
    typeof candidate.taskName === 'string' &&
    typeof candidate.start === 'string'
  );
}
