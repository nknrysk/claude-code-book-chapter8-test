import { cyan, green } from '../formatters/ansi.js';
import { truncateToWidth } from '../formatters/displayWidth.js';
import { formatElapsed } from '../formatters/formatDuration.js';
import {
  ELLIPSIS,
  MEASURING_MARKER,
  MS_PER_MINUTE,
  NO_PROJECT_LABEL,
  PROMPT_TASK_NAME_MAX_WIDTH,
} from '../types/constants.js';
import type { CurrentTimer } from '../types/entities.js';

/** プロンプトに必要な状態。プロジェクト名の解決は ReplSession が済ませる */
export interface PromptState {
  projectName: string | null;
}

/**
 * 現在の状態からプロンプト文字列を組み立てる。
 *
 * 経過時間はコマンド確定のたびに now から再計算する。タイマーによる定期再描画は行わない。
 * 常駐プロセスを 1 分ごとに起床させないことを表示の鮮度より優先する判断であり、
 * 「利用者が経過時間を読むのはコマンドを打った直後である」という前提のもとで
 * 要件の誤差 1 分以内を満たす。
 */
export class PromptRenderer {
  /**
   * 計測中:   "[myproj] ▶ 認証API実装 00:23 > "
   * 計測なし: "[myproj] > "
   * 未選択:   "[未選択] > "
   */
  render(state: PromptState, timer: CurrentTimer | null, now: Date): string {
    const projectLabel = cyan(`[${state.projectName ?? NO_PROJECT_LABEL}]`);
    if (timer === null) return `${projectLabel} > `;

    // 長いタスク名でプロンプトが折り返すと入力が見づらくなるため切り詰める
    const taskName = truncateToWidth(
      timer.taskName,
      PROMPT_TASK_NAME_MAX_WIDTH,
      ELLIPSIS
    );
    const elapsed = formatElapsed(elapsedMinutes(timer.start, now));
    return `${projectLabel} ${green(MEASURING_MARKER)} ${taskName} ${elapsed} > `;
  }
}

/** 100 時間を超えても formatElapsed が桁を伸ばすため、分をそのまま渡す */
function elapsedMinutes(start: string, now: Date): number {
  const elapsed = (now.getTime() - new Date(start).getTime()) / MS_PER_MINUTE;
  return Math.max(0, Math.floor(elapsed));
}
