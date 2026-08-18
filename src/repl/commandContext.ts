import type { ProjectService } from '../services/ProjectService.js';
import type { ReportService } from '../services/ReportService.js';
import type { TimerService } from '../services/TimerService.js';
import type { SessionState } from '../types/entities.js';
import type { OutputFormatter } from './OutputFormatter.js';

/**
 * ハンドラに渡す実行文脈。
 *
 * 現在時刻は REPL レイヤーで確定してから渡す。サービスレイヤーは now を引数で受け取り、
 * 内部で new Date() を呼ばない(規約1)。
 */
export interface CommandContext {
  session: SessionState;
  now: Date;
  projectService: ProjectService;
  timerService: TimerService;
  reportService: ReportService;
  output: OutputFormatter;
}

export interface CommandResult {
  /** 表示する行。空配列なら何も表示しない */
  lines: string[];
  /** REPL の終了要求。計測中は ReplSession が中止する */
  requestExit?: boolean;
}

/** 表示する行を持たない結果 */
export const NO_OUTPUT: CommandResult = { lines: [] };
