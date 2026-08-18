import { writeFile } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CurrentStore } from '../../src/stores/CurrentStore.js';
import { EntryStore } from '../../src/stores/EntryStore.js';
import { ProjectStore } from '../../src/stores/ProjectStore.js';
import { ensureDataDir } from '../../src/stores/ensureDataDir.js';
import {
  currentPath,
  entryPath,
  projectsPath,
} from '../../src/stores/paths.js';
import { DataCorruptedError } from '../../src/types/errors.js';
import { makeEntry } from '../helpers/fixtures.js';
import { useTempHome, type TempHome } from '../helpers/tempHome.js';

describe('破損データの扱い', () => {
  let home: TempHome;

  beforeEach(async () => {
    home = await useTempHome();
    await ensureDataDir();
  });

  afterEach(async () => {
    await home.cleanup();
  });

  describe('EntryStore', () => {
    it('破損行をスキップし、残りの行を読み込む', async () => {
      const valid = JSON.stringify(makeEntry());
      const another = JSON.stringify(
        makeEntry({ start: '2026-08-12T13:00:00+09:00', minutes: 30 })
      );
      await writeFile(
        entryPath('2026-08'),
        `${valid}\n{壊れた行\n${another}\n`
      );

      const result = await new EntryStore().readMonth('2026-08');

      expect(result.entries).toHaveLength(2);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('2 行目');
      expect(result.warnings[0]).toContain('不正なJSON');
    });

    it('必須フィールドを欠く行もスキップする', async () => {
      await writeFile(entryPath('2026-08'), '{"date":"2026-08-12"}\n');

      const result = await new EntryStore().readMonth('2026-08');

      expect(result.entries).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
    });

    it('存在しない月は空の結果を返す(エラーにしない)', async () => {
      const result = await new EntryStore().readMonth('2026-01');

      expect(result).toEqual({ entries: [], warnings: [] });
    });
  });

  describe('ProjectStore', () => {
    it('パースに失敗した場合は DataCorruptedError を投げる(起動を中止させる)', async () => {
      await writeFile(projectsPath(), '{壊れた');

      await expect(new ProjectStore().load()).rejects.toBeInstanceOf(
        DataCorruptedError
      );
    });

    it('構造が不正な場合も DataCorruptedError を投げる', async () => {
      await writeFile(projectsPath(), '{"version":99,"projects":[]}');

      await expect(new ProjectStore().load()).rejects.toBeInstanceOf(
        DataCorruptedError
      );
    });

    it('ファイルが無い場合は空のマスタを返す', async () => {
      expect(await new ProjectStore().load()).toEqual({
        version: 1,
        projects: [],
      });
    });

    it('上書き前の内容を .bak に 1 世代残す', async () => {
      const store = new ProjectStore();
      await store.save({ version: 1, projects: [] });
      await store.save({
        version: 1,
        projects: [
          {
            id: 'p_3x8q1v',
            name: 'myproj',
            archived: false,
            createdAt: '2026-08-01T09:00:00+09:00',
            tasks: [],
          },
        ],
      });

      const { readFile } = await import('node:fs/promises');
      const backup = await readFile(`${projectsPath()}.bak`, 'utf8');

      expect(JSON.parse(backup).projects).toEqual([]);
      expect((await store.load()).projects).toHaveLength(1);
    });
  });

  describe('CurrentStore', () => {
    it('破損時は生の内容を保持した DataCorruptedError を投げる', async () => {
      await writeFile(currentPath(), '{壊れた');

      await expect(new CurrentStore().load()).rejects.toMatchObject({
        name: 'DataCorruptedError',
        rawContent: '{壊れた',
      });
    });

    it('存在しない場合は null(計測していない)を返す', async () => {
      expect(await new CurrentStore().load()).toBeNull();
    });

    it('clear は存在しない場合も成功する', async () => {
      await expect(new CurrentStore().clear()).resolves.toBeUndefined();
    });
  });
});
