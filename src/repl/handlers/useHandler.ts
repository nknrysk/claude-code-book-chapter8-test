import type { CommandContext, CommandResult } from '../commandContext.js';
import type { ParsedCommand } from '../CommandRouter.js';

/** use <プロジェクト>: 作業対象プロジェクトを切り替える */
export async function useHandler(
  command: ParsedCommand,
  ctx: CommandContext
): Promise<CommandResult> {
  if (command.rest === '') {
    return { lines: [ctx.output.missingArgument('use <プロジェクト>')] };
  }

  const project = await ctx.projectService.findProjectByName(command.rest);
  if (project === null) {
    const registered = (await ctx.projectService.listProjects(false)).map(
      (candidate) => candidate.name
    );
    return {
      lines: [
        ctx.output.formatAppError({
          kind: 'ProjectNotFound',
          input: command.rest,
          registered,
        }),
      ],
    };
  }

  ctx.session.currentProjectId = project.id;
  return { lines: [ctx.output.projectSwitched(project.name)] };
}
