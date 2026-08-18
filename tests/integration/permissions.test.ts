import { stat } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CurrentStore } from '../../src/stores/CurrentStore.js';
import { EntryStore } from '../../src/stores/EntryStore.js';
import { ProjectStore } from '../../src/stores/ProjectStore.js';
import { RecoveryLogStore } from '../../src/stores/RecoveryLogStore.js';
import {
  currentPath,
  entriesDir,
  entryPath,
  projectsPath,
  recoveryLogPath,
  timelogHome,
} from '../../src/stores/paths.js';
import { makeCurrentTimer, makeEntry } from '../helpers/fixtures.js';
import { useTempHome, type TempHome } from '../helpers/tempHome.js';

async function permissionOf(path: string): Promise<string> {
  const stats = await stat(path);
  return (stats.mode & 0o777).toString(8);
}

describe('データディレクトリ・ファイルのパーミッション', () => {
  let home: TempHome;

  beforeEach(async () => {
    home = await useTempHome();
  });

  afterEach(async () => {
    await home.cleanup();
  });

  it('ディレクトリは 700、ファイルは 600 で作成される', async () => {
    await new ProjectStore().save({ version: 1, projects: [] });
    await new CurrentStore().save(makeCurrentTimer());
    await new EntryStore().append([makeEntry()]);
    await new RecoveryLogStore().append({ at: '2026-08-13T09:02:00+09:00' });

    expect(await permissionOf(timelogHome())).toBe('700');
    expect(await permissionOf(entriesDir())).toBe('700');
    expect(await permissionOf(projectsPath())).toBe('600');
    expect(await permissionOf(currentPath())).toBe('600');
    expect(await permissionOf(entryPath('2026-08'))).toBe('600');
    expect(await permissionOf(recoveryLogPath())).toBe('600');
  });
});
