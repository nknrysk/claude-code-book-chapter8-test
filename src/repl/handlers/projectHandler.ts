import { validateName } from '../../validators/validateName.js';
import type { CommandContext, CommandResult } from '../commandContext.js';
import type { ParsedCommand } from '../CommandRouter.js';

/**
 * project add / list を扱う。
 * 引数の検証 → サービス呼び出し → 結果の整形のみを行い、業務ルールは持たない。
 */
export async function projectHandler(
  command: ParsedCommand,
  ctx: CommandContext
): Promise<CommandResult> {
  switch (command.sub) {
    case 'add':
      return addProject(command, ctx);
    case 'list':
      return listProjects(ctx);
    default:
      return {
        lines: [
          ctx.output.missingArgument('project add <名前> / project list'),
        ],
      };
  }
}

async function addProject(
  command: ParsedCommand,
  ctx: CommandContext
): Promise<CommandResult> {
  if (command.rest === '') {
    return { lines: [ctx.output.missingArgument('project add <名前>')] };
  }

  const validated = validateName(command.rest, 'project');
  if (!validated.ok) {
    return { lines: [ctx.output.formatAppError(validated.error)] };
  }

  const added = await ctx.projectService.addProject(validated.value, ctx.now);
  if (!added.ok) return { lines: [ctx.output.formatAppError(added.error)] };

  return { lines: [ctx.output.projectAdded(added.value.name)] };
}

async function listProjects(ctx: CommandContext): Promise<CommandResult> {
  const includeArchived = false;
  const projects = await ctx.projectService.listProjects(includeArchived);
  if (projects.length === 0) {
    return {
      lines: [
        ctx.output.info(
          "登録済みのプロジェクトがありません。'project add <名前>' で登録してください"
        ),
      ],
    };
  }

  return {
    lines: projects.map((project) => `  ${project.name}`),
  };
}
