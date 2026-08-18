import { buildEntries } from '../domain/buildEntries.js';
import { truncateToMinute } from '../domain/truncateToMinute.js';
import { formatIsoLocal } from '../formatters/formatIsoLocal.js';
import type { CurrentStore } from '../stores/CurrentStore.js';
import type { EntryStore } from '../stores/EntryStore.js';
import type { RecoveryLogStore } from '../stores/RecoveryLogStore.js';
import { CURRENT_FILE_VERSION } from '../types/constants.js';
import type { CurrentTimer, Entry } from '../types/entities.js';
import type { AppError } from '../types/errors.js';
import type { ProjectId, TaskId } from '../types/ids.js';
import { err, ok, type Result } from '../types/result.js';
import type { ProjectService } from './ProjectService.js';

export interface StartResult {
  started: CurrentTimer;
  /** 計測中に start した場合、自動的に確定されたエントリ */
  autoStopped?: Entry[];
  /** 他プロセスが開始した計測を確定した場合の警告(多重起動の検知) */
  warnings: string[];
}

/**
 * 計測の開始・終了・再開・備考設定と、current.json のライフサイクル管理。
 *
 * 現在時刻は必ず引数で受け取る(規約1)。日跨ぎ分割の正しさは時刻依存のシナリオでしか
 * 検証できず、内部で new Date() を呼ぶとテストがシステムクロックに依存する。
 */
export class TimerService {
  /**
   * 自プロセスが書き込んだ計測の開始時刻。
   * これと異なる current.json を確定する場合、別プロセスの timelog が開始した計測である
   * (ファイルロックを持たないため、検知して警告するに留める)
   */
  private startedByThisProcess: string | null = null;

  constructor(
    private readonly currentStore: CurrentStore,
    private readonly entryStore: EntryStore,
    private readonly recoveryLogStore: RecoveryLogStore,
    private readonly projectService: ProjectService
  ) {}

  async getCurrent(): Promise<CurrentTimer | null> {
    return this.currentStore.load();
  }

  /** 計測中の場合は自動で確定してから開始する */
  async start(
    projectId: ProjectId,
    taskId: TaskId,
    note: string | undefined,
    now: Date
  ): Promise<Result<StartResult, AppError>> {
    const project = await this.projectService.findProjectById(projectId);
    if (project === null) {
      return err({ kind: 'ProjectNotFound', input: projectId, registered: [] });
    }
    const task = project.tasks.find((candidate) => candidate.id === taskId);
    if (task === undefined) {
      return err({ kind: 'NotFound', input: taskId });
    }

    const warnings: string[] = [];
    const running = await this.currentStore.load();
    let autoStopped: Entry[] | undefined;
    if (running !== null) {
      if (this.startedByThisProcess !== running.start) {
        warnings.push(
          '別のプロセスで開始された計測を確定しました。timelog の多重起動に注意してください'
        );
      }
      autoStopped = await this.finalize(running, now);
    }

    const started: CurrentTimer = {
      version: CURRENT_FILE_VERSION,
      projectId: project.id,
      projectName: project.name,
      taskId: task.id,
      taskName: task.name,
      start: formatIsoLocal(now),
      ...(note !== undefined && note !== '' ? { note } : {}),
    };

    // start 時点で即座に永続化する。異常終了しても開始時刻を失わない
    await this.currentStore.save(started);
    this.startedByThisProcess = started.start;
    await this.projectService.touchTask(project.id, task.id, now);

    return ok({
      started,
      ...(autoStopped !== undefined ? { autoStopped } : {}),
      warnings,
    });
  }

  /** 計測を終了し、日跨ぎ分割後のエントリ群を返す */
  async stop(now: Date): Promise<Result<Entry[], AppError>> {
    const running = await this.currentStore.load();
    if (running === null) return err({ kind: 'NotMeasuring' });

    return ok(await this.finalize(running, now));
  }

  /**
   * 直前に確定したエントリと同じタスクで計測を開始する。
   * 引き継ぐのはタスクのみで、備考は引き継がない(同じ作業の続きでも内容は変わるため)。
   */
  async resume(now: Date): Promise<Result<StartResult, AppError>> {
    const latest = await this.entryStore.readLatest();
    if (latest === null) return err({ kind: 'NoResumeTarget' });

    return this.start(latest.projectId, latest.taskId, undefined, now);
  }

  /** 計測中エントリの備考を上書きする(追記はしない) */
  async setNote(text: string): Promise<Result<CurrentTimer, AppError>> {
    const running = await this.currentStore.load();
    if (running === null) return err({ kind: 'NotMeasuring' });

    const updated: CurrentTimer = { ...running, note: text };
    await this.currentStore.save(updated);
    return ok(updated);
  }

  /** 復帰フロー用。指定した終了時刻で計測を確定する */
  async finalizeRecovered(end: Date): Promise<Result<Entry[], AppError>> {
    const running = await this.currentStore.load();
    if (running === null) return err({ kind: 'NotMeasuring' });

    const start = new Date(running.start);
    if (truncateToMinute(end) < truncateToMinute(start)) {
      return err({
        kind: 'InvalidTimeRange',
        start: running.start,
        end: formatIsoLocal(end),
      });
    }

    return ok(await this.finalize(running, end));
  }

  /**
   * 復帰導線が発火したことを記録する(KPI 測定)。
   * 確定の成否に関わらず、フロー突入時に 1 度だけ呼ぶ。
   *
   * 記録の失敗は復帰フローを中断させない。KPI 計測用の副次的な記録が、
   * ユーザーのデータ確定を妨げてはならない。
   */
  async recordRecoveryStarted(now: Date): Promise<void> {
    try {
      await this.recoveryLogStore.append({ at: formatIsoLocal(now) });
    } catch {
      // 記録できなくても復帰フローは続行する
    }
  }

  /**
   * 破損した current.json を破棄する(復帰フローで利用者が破棄を選んだ場合)。
   * 失っても影響は計測中の 1 件に限られる
   */
  async discardCurrent(): Promise<void> {
    await this.currentStore.clear();
    this.startedByThisProcess = null;
  }

  /** 計測を確定し、エントリを追記して current.json を削除する */
  private async finalize(timer: CurrentTimer, end: Date): Promise<Entry[]> {
    const entries = buildEntries(new Date(timer.start), end, timer);
    await this.entryStore.append(entries);
    await this.currentStore.clear();
    this.startedByThisProcess = null;
    return entries;
  }
}
