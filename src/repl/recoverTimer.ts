import type { TimerService } from '../services/TimerService.js';
import { DataCorruptedError } from '../types/errors.js';
import { parseTimeInput } from '../validators/parseTimeInput.js';
import type { OutputFormatter } from './OutputFormatter.js';
import type { ReplIo } from './ReplIo.js';

export interface RecoverDeps {
  timerService: TimerService;
  io: ReplIo;
  output: OutputFormatter;
  now: Date;
}

/**
 * 起動時の復帰フロー。current.json があれば終了時刻を対話的に尋ねて確定する。
 *
 * 起動シーケンスから独立したファイルに置く。呼び出し順序(復帰 → 入力ループ)は
 * ReplSession の責務だが、終了時刻を尋ねるフロー自体は独立して読めるべきものである。
 *
 * 入力を中断した場合は current.json を保持したまま戻る。記録を失わないことを優先する。
 */
export async function recoverTimer(deps: RecoverDeps): Promise<void> {
  const { timerService, io, output, now } = deps;

  let current;
  try {
    current = await timerService.getCurrent();
  } catch (error) {
    if (error instanceof DataCorruptedError) {
      await handleCorrupted(error, deps);
      return;
    }
    throw error;
  }

  if (current === null) return;

  // 確定の成否に関わらず、フロー突入時点で 1 件記録する(KPI は異常終了の頻度を測る)
  await timerService.recordRecoveryStarted(now);

  io.write(
    output.warning(
      `計測中のまま終了していました: ${current.taskName} (開始: ${formatStart(current.start)})`
    )
  );

  for (;;) {
    const answer = await io.question(
      '終了時刻を入力してください (HH:MM または YYYY-MM-DD HH:MM。空入力で保留): '
    );

    if (answer === null || answer.trim() === '') {
      io.write(output.info('復帰を保留しました。current.json は保持されます'));
      return;
    }

    const parsed = parseTimeInput(answer, new Date(current.start));
    if (!parsed.ok) {
      io.write(output.invalidTimeFormat(parsed.error.input));
      continue;
    }

    const finalized = await timerService.finalizeRecovered(parsed.value);
    if (!finalized.ok) {
      io.write(output.formatAppError(finalized.error));
      continue;
    }

    io.write(output.stopped(finalized.value));
    return;
  }
}

/**
 * current.json が破損している場合。内容を提示して破棄の可否を尋ねる。
 * 失っても影響が計測中の 1 件に限られるため、破棄を選べる形にしている。
 */
async function handleCorrupted(
  error: DataCorruptedError,
  deps: RecoverDeps
): Promise<void> {
  const { io, output } = deps;

  io.write(output.error(`${error.filePath} が破損しています。`));
  io.write(output.muted(`内容: ${error.rawContent.trim()}`));

  const answer = await io.question('破棄して起動しますか? (y/N): ');
  if (answer !== null && answer.trim().toLowerCase() === 'y') {
    await deps.timerService.discardCurrent();
    io.write(output.info('current.json を破棄しました'));
    return;
  }

  io.write(
    output.info(
      'current.json を保持したまま起動します。ファイルを修正すると復帰できます'
    )
  );
}

/** ISO 8601 を "MM/DD HH:MM" に整形する(復帰の案内は日付も示す) */
function formatStart(iso: string): string {
  return `${iso.slice(5, 10).replace('-', '/')} ${iso.slice(11, 16)}`;
}
