import { mkdir } from 'node:fs/promises';
import { DIR_MODE } from '../types/constants.js';
import { entriesDir, timelogHome } from './paths.js';

/**
 * データディレクトリを 0o700 で用意する。存在する場合は何もしない。
 * mode は mkdir の時点で指定し、process.umask に依存しない。
 */
export async function ensureDataDir(): Promise<void> {
  await mkdir(timelogHome(), { recursive: true, mode: DIR_MODE });
  await mkdir(entriesDir(), { recursive: true, mode: DIR_MODE });
}
