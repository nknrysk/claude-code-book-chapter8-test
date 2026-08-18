import { formatDate } from '../../formatters/formatDate.js';
import { formatDuration } from '../../formatters/formatDuration.js';
import { renderTable } from '../../formatters/renderTable.js';
import { parseDateInput } from '../../validators/parseDateInput.js';
import type { CommandContext, CommandResult } from '../commandContext.js';
import type { ParsedCommand } from '../CommandRouter.js';

/** show [YYYY-MM-DD]: 1日の作業実績とタスク別小計を表示する */
export async function showHandler(
  command: ParsedCommand,
  ctx: CommandContext
): Promise<CommandResult> {
  const input = command.args[0];
  let date: string;
  if (input === undefined) {
    date = formatDate(ctx.now);
  } else {
    const parsed = parseDateInput(input);
    if (!parsed.ok) {
      return { lines: [ctx.output.invalidDateFormat(parsed.error.input)] };
    }
    date = parsed.value;
  }

  const { report, warnings } = await ctx.reportService.daily(date);
  // P1 の edit が既定の対象日として参照する
  ctx.session.lastShownDate = date;

  const lines = warnings.map((warning) => ctx.output.warning(warning));

  if (report.rows.length === 0) {
    lines.push(ctx.output.emptyDailyReport(date));
    return { lines };
  }

  lines.push(ctx.output.info(`${date} の作業実績`), '');
  lines.push(
    ...renderTable(
      [
        { header: '#', align: 'right' },
        { header: '開始' },
        { header: '終了' },
        { header: '時間' },
        { header: 'プロジェクト' },
        { header: 'タスク' },
        { header: '備考' },
      ],
      report.rows.map((row) => [
        String(row.lineNo),
        timeOf(row.entry.start),
        timeOf(row.entry.end),
        formatDuration(row.entry.minutes),
        row.projectName,
        row.taskName,
        row.entry.note ?? '',
      ]),
      { indent: '  ' }
    )
  );

  lines.push('', ctx.output.info('  タスク別小計'));
  lines.push(
    ...renderTable(
      [{ header: '' }, { header: '' }],
      report.subtotals.map((subtotal) => [
        `${subtotal.projectName} / ${subtotal.taskName}`,
        ctx.output.duration(subtotal.minutes),
      ]),
      { indent: '    ', showHeader: false }
    )
  );

  lines.push('', `  合計  ${ctx.output.duration(report.totalMinutes)}`);
  return { lines };
}

/** ISO 8601 の時刻部分 "HH:MM" を取り出す */
function timeOf(iso: string): string {
  return iso.slice(11, 16);
}
