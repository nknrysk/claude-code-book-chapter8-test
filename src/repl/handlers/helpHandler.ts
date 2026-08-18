import type { CommandContext, CommandResult } from '../commandContext.js';
import type { ParsedCommand } from '../CommandRouter.js';
import { COMMAND_SPECS, findSpecs } from '../commandSpecs.js';

/**
 * help / help <コマンド名> を扱う。
 * COMMAND_SPECS を唯一の情報源とするため、コマンドを追加すれば help も自動的に追随する。
 */
export function helpHandler(
  command: ParsedCommand,
  ctx: CommandContext
): CommandResult {
  const target = command.args[0];
  if (target === undefined) return { lines: listAll(ctx) };

  const specs = findSpecs(target.toLowerCase());
  if (specs.length === 0) {
    return {
      lines: [
        ctx.output.error(
          `'${target}' というコマンドはありません。'help' でコマンド一覧を確認できます`
        ),
      ],
    };
  }

  const lines: string[] = [];
  for (const spec of specs) {
    lines.push(`  ${spec.usage}`);
    lines.push(`    ${spec.summary}`);
    for (const example of spec.examples) {
      lines.push(ctx.output.muted(`    例: ${example}`));
    }
  }
  return { lines };
}

function listAll(ctx: CommandContext): string[] {
  const width = Math.max(...COMMAND_SPECS.map((spec) => spec.usage.length));
  return [
    ctx.output.muted('コマンド一覧'),
    ...COMMAND_SPECS.map(
      (spec) => `  ${spec.usage.padEnd(width)}  ${spec.summary}`
    ),
    ctx.output.muted("  'help <コマンド名>' で使用例を表示します"),
  ];
}
