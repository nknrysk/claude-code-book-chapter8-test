import { validateName } from '../../validators/validateName.js';
import type { CommandContext, CommandResult } from '../commandContext.js';
import type { ParsedCommand } from '../CommandRouter.js';

/** task add / list を扱う。いずれもプロジェクトの選択を前提とする */
export async function taskHandler(
  command: ParsedCommand,
  ctx: CommandContext
): Promise<CommandResult> {
  const projectId = ctx.session.currentProjectId;
  if (projectId === null) {
    return {
      lines: [ctx.output.formatAppError({ kind: 'NoProjectSelected' })],
    };
  }

  switch (command.sub) {
    case 'add':
      return addTask(command, ctx, projectId);
    case 'list':
      return listTasks(ctx, projectId);
    default:
      return {
        lines: [ctx.output.missingArgument('task add <名前> / task list')],
      };
  }
}

async function addTask(
  command: ParsedCommand,
  ctx: CommandContext,
  projectId: string
): Promise<CommandResult> {
  if (command.rest === '') {
    return { lines: [ctx.output.missingArgument('task add <名前>')] };
  }

  const validated = validateName(command.rest, 'task');
  if (!validated.ok) {
    return { lines: [ctx.output.formatAppError(validated.error)] };
  }

  const added = await ctx.projectService.addTask(
    projectId,
    validated.value,
    ctx.now
  );
  if (!added.ok) return { lines: [ctx.output.formatAppError(added.error)] };

  return { lines: [ctx.output.taskAdded(added.value.name)] };
}

async function listTasks(
  ctx: CommandContext,
  projectId: string
): Promise<CommandResult> {
  // 表示連番はこの配列の添字+1。start <番号> の解決も同じ配列から導かれる
  const tasks = await ctx.projectService.listTasks(projectId, false);
  if (tasks.length === 0) {
    return {
      lines: [
        ctx.output.info(
          "タスクが登録されていません。'task add <名前>' で登録してください"
        ),
      ],
    };
  }

  return {
    lines: tasks.map(
      (task, index) => `  ${String(index + 1).padStart(2)}  ${task.name}`
    ),
  };
}
