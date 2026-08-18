import { ReplSession } from '../../src/repl/ReplSession.js';
import { buildServices, type Services } from './services.js';
import { ScriptedIo } from './scriptedIo.js';

export interface RunOptions {
  /** REPL に流し込む入力行 */
  inputs: (string | null)[];
  /**
   * 各入力を処理する時点の現在時刻。
   * 配列を渡すと inputs と同じ位置の時刻が使われる(不足分は最後の値を使い続ける)。
   *
   * ReplSession は 1 コマンドにつき複数回 now() を呼ぶため、時刻は入力に紐づけて進める。
   */
  now: Date | Date[];
  services?: Services;
}

export interface RunOutcome {
  io: ScriptedIo;
  services: Services;
}

/** ReplSession を差し替え IO で起動し、シナリオを流す */
export async function runRepl(options: RunOptions): Promise<RunOutcome> {
  const services = options.services ?? buildServices();
  const times = Array.isArray(options.now) ? options.now : [options.now];

  let currentTime = times[0];
  const io = new ScriptedIo(options.inputs, (index) => {
    currentTime = times[Math.min(index, times.length - 1)];
  });

  const session = new ReplSession({
    projectService: services.projectService,
    timerService: services.timerService,
    reportService: services.reportService,
    io,
    clock: () => currentTime,
  });

  await session.run();
  return { io, services };
}
