import type { Task } from './entities.js';

/**
 * サービスレイヤーが Result で返す想定内エラーの判別可能ユニオン。
 * docs/glossary.md の AppError と 1 対 1 で対応する。
 *
 * MVP(P0) で発生しない TaskInUse / ExportPathNotFound も型に含める。
 * OutputFormatter の網羅 switch に文言を用意しておくことで、
 * P1 で archive / export を足したときに文言の追加漏れが型検査に現れる。
 */
export type AppError =
  | { kind: 'NoProjectSelected' }
  | { kind: 'ProjectNotFound'; input: string; registered: string[] }
  | { kind: 'DuplicateName'; target: NameTarget; name: string }
  | { kind: 'InvalidName'; target: NameTarget; reason: InvalidNameReason }
  | { kind: 'IndexOutOfRange'; input: string; max: number }
  | { kind: 'NotFound'; input: string }
  | { kind: 'Ambiguous'; input: string; candidates: Task[] }
  | { kind: 'NotMeasuring' }
  | { kind: 'NoResumeTarget' }
  | { kind: 'TaskInUse'; taskName: string }
  | { kind: 'InvalidTimeRange'; start: string; end: string }
  | { kind: 'ExportPathNotFound'; dir: string };

/** エラー文言でプロジェクトとタスクを言い分けるための区別 */
export type NameTarget = 'project' | 'task';

export type InvalidNameReason = 'length' | 'control-character';

/**
 * 真の異常。projects.json / current.json のパース失敗に用いる。
 * 復旧の案内に生の内容を必要とするため、rawContent を保持する。
 */
export class DataCorruptedError extends Error {
  constructor(
    message: string,
    public readonly filePath: string,
    public readonly rawContent: string
  ) {
    super(message);
    this.name = 'DataCorruptedError';
  }
}
