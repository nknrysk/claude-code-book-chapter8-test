import type { ProjectService } from '../services/ProjectService.js';
import type { ReportService } from '../services/ReportService.js';
import type { TimerService } from '../services/TimerService.js';
import type { CurrentTimer, SessionState } from '../types/entities.js';
import { CommandRouter } from './CommandRouter.js';
import type { CommandContext } from './commandContext.js';
import { OutputFormatter } from './OutputFormatter.js';
import { PromptRenderer } from './PromptRenderer.js';
import { recoverTimer } from './recoverTimer.js';
import type { ReplIo } from './ReplIo.js';

export interface ReplSessionDeps {
  projectService: ProjectService;
  timerService: TimerService;
  reportService: ReportService;
  io: ReplIo;
  /** 現在時刻の供給元。テストで固定できるよう差し替え可能にする */
  clock?: () => Date;
}

const BANNER = "timelog v0.1.0  ('help' でコマンド一覧)";

/**
 * 起動シーケンス・入力ループ・終了フローを制御する。
 *
 * 現在時刻の取得はこのレイヤーの責務であり、サービスへは引数として渡す(規約1)。
 */
export class ReplSession {
  private readonly router = new CommandRouter();
  private readonly prompt = new PromptRenderer();
  private readonly output = new OutputFormatter();
  /** 連続した入力終端の回数。閉じたストリームでの無限ループを防ぐ */
  private endOfInputCount = 0;

  private readonly session: SessionState = {
    currentProjectId: null,
    lastShownDate: null,
  };

  constructor(private readonly deps: ReplSessionDeps) {}

  /** 起動から終了までを実行する */
  async run(): Promise<void> {
    const { io } = this.deps;

    await this.deps.projectService.load();
    io.write(BANNER);
    await this.recoverIfNeeded();

    io.onSigint(() => {
      io.write(this.output.info("終了するには 'exit' を入力してください"));
    });

    for (;;) {
      const timer = await this.currentTimer();
      const promptText = this.prompt.render(
        { projectName: await this.currentProjectName() },
        timer,
        this.now()
      );

      const line = await io.question(promptText);
      if (line === null) {
        if (await this.handleEndOfInput()) return;
        continue;
      }

      this.endOfInputCount = 0;
      const shouldExit = await this.handleLine(line);
      if (shouldExit) return;
    }
  }

  /**
   * 起動時の復帰フロー。フロー本体は recoverTimer.ts に持ち、ここでは委譲のみ行う
   * (run() における呼び出し順序の制御だけが ReplSession の責務)。
   */
  private async recoverIfNeeded(): Promise<void> {
    await recoverTimer({
      timerService: this.deps.timerService,
      io: this.deps.io,
      output: this.output,
      now: this.now(),
    });
  }

  /** 1 行を処理する。終了する場合のみ true を返す */
  private async handleLine(line: string): Promise<boolean> {
    const { io } = this.deps;
    const parsed = this.router.parse(line);

    if (!parsed.ok) {
      if (parsed.error.kind === 'UnknownCommand') {
        io.write(this.output.unknownCommand(parsed.error.input));
      }
      return false;
    }

    if (parsed.command.name === 'exit') return this.handleExit();

    try {
      const result = await this.router.dispatch(parsed.command, this.context());
      for (const outputLine of result.lines) io.write(outputLine);
    } catch (error) {
      // 予期しない例外でもループは止めない。記録は保存済みであることを伝える
      for (const outputLine of this.output.unexpectedError(error)) {
        io.write(outputLine);
      }
    }
    return false;
  }

  /**
   * 入力の終端(Ctrl-D / パイプの終わり)の処理。
   *
   * 計測中の Ctrl-D は exit と同じく終了を中止するが、入力ストリームが閉じている場合は
   * 二度と入力が来ないため、警告して終了する(中止し続けると無限ループになる)。
   * current.json は保持されるため、次回起動時の復帰フローで確定できる。
   */
  private async handleEndOfInput(): Promise<boolean> {
    if (await this.handleExit()) return true;

    this.endOfInputCount += 1;
    if (this.endOfInputCount < 2) return false;

    this.deps.io.write(
      this.output.info(
        '入力が終了したため終了します。計測中の記録は保持され、次回起動時に復帰できます'
      )
    );
    return true;
  }

  /** 終了要求の処理。計測中なら false を返してループを継続する */
  private async handleExit(): Promise<boolean> {
    const timer = await this.currentTimer();
    if (timer !== null) {
      this.deps.io.write(this.output.measuringOnExit(timer.taskName));
      return false;
    }
    return true;
  }

  private context(): CommandContext {
    return {
      session: this.session,
      now: this.now(),
      projectService: this.deps.projectService,
      timerService: this.deps.timerService,
      reportService: this.deps.reportService,
      output: this.output,
    };
  }

  /** 破損していた場合はプロンプト表示のために計測なしとして扱う(復帰フローで案内済み) */
  private async currentTimer(): Promise<CurrentTimer | null> {
    try {
      return await this.deps.timerService.getCurrent();
    } catch {
      return null;
    }
  }

  private async currentProjectName(): Promise<string | null> {
    const projectId = this.session.currentProjectId;
    if (projectId === null) return null;

    const project = await this.deps.projectService.findProjectById(projectId);
    return project?.name ?? null;
  }

  private now(): Date {
    return this.deps.clock !== undefined ? this.deps.clock() : new Date();
  }
}
