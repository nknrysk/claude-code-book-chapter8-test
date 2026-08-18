import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { atomicWrite } from '../../src/stores/atomicWrite.js';
import { FILE_MODE } from '../../src/types/constants.js';
import { useTempHome, type TempHome } from '../helpers/tempHome.js';

describe('atomicWrite', () => {
  let home: TempHome;

  beforeEach(async () => {
    home = await useTempHome();
  });

  afterEach(async () => {
    await home.cleanup();
  });

  it('内容を書き込み、一時ファイルを残さない', async () => {
    const target = join(home.path, 'data.json');

    await atomicWrite(target, '{"a":1}', FILE_MODE);

    expect(await readFile(target, 'utf8')).toBe('{"a":1}');
    expect(await readdir(home.path)).toEqual(['data.json']);
  });

  it('既存ファイルを置き換える', async () => {
    const target = join(home.path, 'data.json');
    await writeFile(target, 'old');

    await atomicWrite(target, 'new', FILE_MODE);

    expect(await readFile(target, 'utf8')).toBe('new');
  });

  it('書き込みに失敗しても既存ファイルが壊れない', async () => {
    const target = join(home.path, 'data.json');
    await writeFile(target, 'original');

    // 存在しないディレクトリを対象にすると一時ファイルの作成で失敗する
    const brokenTarget = join(home.path, 'missing-dir', 'data.json');
    await expect(atomicWrite(brokenTarget, 'x', FILE_MODE)).rejects.toThrow();

    expect(await readFile(target, 'utf8')).toBe('original');
  });
});
