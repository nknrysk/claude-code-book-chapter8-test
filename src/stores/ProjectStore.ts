import { copyFile, readFile } from 'node:fs/promises';
import {
  BACKUP_SUFFIX,
  FILE_MODE,
  PROJECTS_FILE_VERSION,
} from '../types/constants.js';
import type { ProjectsFile } from '../types/entities.js';
import { DataCorruptedError } from '../types/errors.js';
import { atomicWrite } from './atomicWrite.js';
import { ensureDataDir } from './ensureDataDir.js';
import { isNotFoundError } from './fsErrors.js';
import { projectsPath } from './paths.js';

/**
 * projects.json の読み書き。業務ルール(採番・整列・解決)は持たない。
 */
export class ProjectStore {
  /**
   * マスタを読み込む。ファイルが存在しない場合は空の初期値を返す。
   *
   * @throws DataCorruptedError パースに失敗した場合。マスタが読めない状態で操作を続けると、
   *   新規登録で既存の ID 体系を上書きし得るため、呼び出し側は起動を中止する
   */
  async load(): Promise<ProjectsFile> {
    let raw: string;
    try {
      raw = await readFile(projectsPath(), 'utf8');
    } catch (error) {
      if (isNotFoundError(error)) {
        return { version: PROJECTS_FILE_VERSION, projects: [] };
      }
      throw error;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new DataCorruptedError(
        'projects.json のパースに失敗しました',
        projectsPath(),
        raw
      );
    }

    if (!isProjectsFile(parsed)) {
      throw new DataCorruptedError(
        'projects.json の構造が不正です',
        projectsPath(),
        raw
      );
    }
    return parsed;
  }

  /**
   * マスタを全置換で保存する。上書き前の内容を 1 世代だけ .bak に残す。
   * 人が直接編集して修復できるよう整形して書く。
   */
  async save(data: ProjectsFile): Promise<void> {
    await ensureDataDir();
    await this.backup();
    await atomicWrite(
      projectsPath(),
      `${JSON.stringify(data, null, 2)}\n`,
      FILE_MODE
    );
  }

  private async backup(): Promise<void> {
    try {
      await copyFile(projectsPath(), `${projectsPath()}${BACKUP_SUFFIX}`);
    } catch (error) {
      // 初回保存時は元ファイルが無い。バックアップの失敗で保存自体を止めない
      if (!isNotFoundError(error)) throw error;
    }
  }
}

/** 外部から来る値は unknown で受け、型ガードで検証してから使う */
function isProjectsFile(value: unknown): value is ProjectsFile {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.version === PROJECTS_FILE_VERSION &&
    Array.isArray(candidate.projects)
  );
}
