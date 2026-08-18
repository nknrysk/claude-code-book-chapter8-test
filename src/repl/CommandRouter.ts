import type { CommandContext, CommandResult } from './commandContext.js';
import { COMMANDS_WITH_SUB, isKnownCommand } from './commandSpecs.js';
import { helpHandler } from './handlers/helpHandler.js';
import { projectHandler } from './handlers/projectHandler.js';
import { showHandler } from './handlers/showHandler.js';
import { taskHandler } from './handlers/taskHandler.js';
import { timerHandler } from './handlers/timerHandler.js';
import { useHandler } from './handlers/useHandler.js';

export interface ParsedCommand {
  name: string;
  /** project / task のサブコマンド */
  sub?: string;
  /** フラグを除いた位置引数 */
  args: string[];
  /** 各位置引数の位置から行末までの生文字列。備考など空白を保つ用途に使う */
  argRests: string[];
  /** コマンド名(とサブコマンド)より後ろの生文字列 */
  rest: string;
  flags: Record<string, string | boolean>;
}

export interface ParseError {
  kind: 'UnknownCommand' | 'EmptyInput';
  input: string;
}

export type ParseResult =
  | { ok: true; command: ParsedCommand }
  | { ok: false; error: ParseError };

interface Token {
  value: string;
  /** 入力行における開始位置。備考を生のまま切り出すために保持する */
  offset: number;
}

/**
 * 入力行をコマンド名・サブコマンド・引数・フラグに分解する。
 *
 * 引用符で囲まれた部分は 1 トークンとして扱う(`task add "認証 API 実装"`)。
 * 備考は空白を保つ必要があるため、トークンの開始位置から行末までを別途保持する。
 */
export class CommandRouter {
  parse(line: string): ParseResult {
    const tokens = tokenize(line);
    if (tokens.length === 0) {
      return { ok: false, error: { kind: 'EmptyInput', input: line } };
    }

    const name = tokens[0].value.toLowerCase();
    if (!isKnownCommand(name)) {
      return {
        ok: false,
        error: { kind: 'UnknownCommand', input: tokens[0].value },
      };
    }

    let consumed = 1;
    let sub: string | undefined;
    if (COMMANDS_WITH_SUB.has(name) && tokens.length > 1) {
      sub = tokens[1].value.toLowerCase();
      consumed = 2;
    }

    const remaining = tokens.slice(consumed);
    const { positional, flags } = extractFlags(remaining);

    return {
      ok: true,
      command: {
        name,
        ...(sub !== undefined ? { sub } : {}),
        args: positional.map((token) => token.value),
        argRests: positional.map((token) => line.slice(token.offset).trim()),
        rest:
          remaining.length > 0 ? line.slice(remaining[0].offset).trim() : '',
        flags,
      },
    };
  }

  /** パース済みコマンドを対応するハンドラへ振り分ける */
  async dispatch(
    command: ParsedCommand,
    ctx: CommandContext
  ): Promise<CommandResult> {
    switch (command.name) {
      case 'project':
        return projectHandler(command, ctx);
      case 'use':
        return useHandler(command, ctx);
      case 'task':
        return taskHandler(command, ctx);
      case 'start':
      case 'stop':
      case 'resume':
      case 'note':
        return timerHandler(command, ctx);
      case 'show':
        return showHandler(command, ctx);
      case 'help':
        return helpHandler(command, ctx);
      case 'exit':
        return { lines: [], requestExit: true };
      default:
        // isKnownCommand を通過した名前のみが来るため、ここには到達しない
        return { lines: [ctx.output.unknownCommand(command.name)] };
    }
  }
}

/** 引用符を 1 トークンとして扱いつつ、各トークンの開始位置を記録する */
function tokenize(line: string): Token[] {
  const tokens: Token[] = [];
  let current = '';
  let offset = -1;
  let quote: '"' | "'" | null = null;

  const flush = (): void => {
    if (offset >= 0) {
      tokens.push({ value: current, offset });
      current = '';
      offset = -1;
    }
  };

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (quote !== null) {
      if (char === quote) quote = null;
      else current += char;
      continue;
    }
    if (char === '"' || char === "'") {
      if (offset < 0) offset = index;
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      flush();
      continue;
    }
    if (offset < 0) offset = index;
    current += char;
  }
  flush();

  return tokens;
}

/** `--` で始まるトークンをフラグとして抽出し、位置引数から除外する */
function extractFlags(tokens: Token[]): {
  positional: Token[];
  flags: Record<string, string | boolean>;
} {
  const positional: Token[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token.value.startsWith('--')) {
      positional.push(token);
      continue;
    }

    const name = token.value.slice(2);
    const next = tokens[index + 1];
    if (next !== undefined && !next.value.startsWith('--')) {
      flags[name] = next.value;
      index += 1;
    } else {
      flags[name] = true;
    }
  }

  return { positional, flags };
}
