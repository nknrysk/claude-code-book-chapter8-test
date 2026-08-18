import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TIMELOG_HOME_ENV } from '../../src/types/constants.js';

export interface TempHome {
  path: string;
  cleanup: () => Promise<void>;
}

/**
 * TIMELOG_HOME に一時ディレクトリを割り当てる。
 * paths.ts が環境変数を都度評価するため、実ファイルに対する検証をここで隔離できる。
 */
export async function useTempHome(): Promise<TempHome> {
  const path = await mkdtemp(join(tmpdir(), 'timelog-test-'));
  const previous = process.env[TIMELOG_HOME_ENV];
  process.env[TIMELOG_HOME_ENV] = path;

  return {
    path,
    cleanup: async () => {
      if (previous === undefined) delete process.env[TIMELOG_HOME_ENV];
      else process.env[TIMELOG_HOME_ENV] = previous;
      await rm(path, { recursive: true, force: true });
    },
  };
}
