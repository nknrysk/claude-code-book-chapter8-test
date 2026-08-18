import type { StartResult } from '../../services/TimerService.js';
import type { CommandContext, CommandResult } from '../commandContext.js';
import type { ParsedCommand } from '../CommandRouter.js';

/** start / stop / resume / note を扱う */
export async function timerHandler(
  command: ParsedCommand,
  ctx: CommandContext
): Promise<CommandResult> {
  switch (command.name) {
    case 'start':
      return start(command, ctx);
    case 'stop':
      return stop(ctx);
    case 'resume':
      return resume(ctx);
    case 'note':
      return setNote(command, ctx);
    default:
      return { lines: [ctx.output.unknownCommand(command.name)] };
  }
}

async function start(
  command: ParsedCommand,
  ctx: CommandContext
): Promise<CommandResult> {
  const projectId = ctx.session.currentProjectId;
  if (projectId === null) {
    return {
      lines: [ctx.output.formatAppError({ kind: 'NoProjectSelected' })],
    };
  }
  if (command.args.length === 0) {
    return { lines: [ctx.output.missingArgument('start <番号|名前> [備考]')] };
  }

  const resolved = await ctx.projectService.resolveTask(
    projectId,
    command.args[0]
  );
  if (!resolved.ok) {
    return { lines: [ctx.output.formatAppError(resolved.error)] };
  }

  // 備考は空白を保ったまま扱うため、第 2 引数の位置から行末までの生文字列を使う
  const note = command.argRests[1];
  const started = await ctx.timerService.start(
    projectId,
    resolved.value.id,
    note,
    ctx.now
  );
  if (!started.ok) return { lines: [ctx.output.formatAppError(started.error)] };

  return { lines: startLines(started.value, ctx) };
}

async function stop(ctx: CommandContext): Promise<CommandResult> {
  const stopped = await ctx.timerService.stop(ctx.now);
  if (!stopped.ok) return { lines: [ctx.output.formatAppError(stopped.error)] };

  return { lines: [ctx.output.stopped(stopped.value)] };
}

async function resume(ctx: CommandContext): Promise<CommandResult> {
  const resumed = await ctx.timerService.resume(ctx.now);
  if (!resumed.ok) return { lines: [ctx.output.formatAppError(resumed.error)] };

  // resume したタスクのプロジェクトへ作業対象も合わせる
  ctx.session.currentProjectId = resumed.value.started.projectId;
  return { lines: startLines(resumed.value, ctx) };
}

async function setNote(
  command: ParsedCommand,
  ctx: CommandContext
): Promise<CommandResult> {
  if (command.rest === '') {
    return { lines: [ctx.output.missingArgument('note <テキスト>')] };
  }

  const updated = await ctx.timerService.setNote(command.rest);
  if (!updated.ok) return { lines: [ctx.output.formatAppError(updated.error)] };

  return { lines: [ctx.output.noteSet()] };
}

/** 自動確定・多重起動の警告を、開始メッセージと合わせて表示する */
function startLines(result: StartResult, ctx: CommandContext): string[] {
  const lines: string[] = [];
  for (const warning of result.warnings) {
    lines.push(ctx.output.warning(warning));
  }
  if (result.autoStopped !== undefined) {
    lines.push(ctx.output.stopped(result.autoStopped));
  }
  lines.push(ctx.output.started(result.started));
  return lines;
}
