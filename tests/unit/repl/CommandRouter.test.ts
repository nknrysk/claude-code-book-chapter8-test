import { describe, expect, it } from 'vitest';
import { CommandRouter } from '../../../src/repl/CommandRouter.js';

const router = new CommandRouter();

function parse(line: string) {
  const result = router.parse(line);
  if (!result.ok) throw new Error(`パースに失敗しました: ${line}`);
  return result.command;
}

describe('CommandRouter.parse', () => {
  it('コマンド名と引数に分解する', () => {
    const command = parse('start 1');

    expect(command.name).toBe('start');
    expect(command.args).toEqual(['1']);
  });

  it('project / task はサブコマンドを切り出す', () => {
    const command = parse('project add myproj');

    expect(command.name).toBe('project');
    expect(command.sub).toBe('add');
    expect(command.rest).toBe('myproj');
  });

  it('備考は空白を保ったまま第 2 引数以降を連結する', () => {
    const command = parse('start 1 JWT の 検証まわり');

    expect(command.args[0]).toBe('1');
    expect(command.argRests[1]).toBe('JWT の 検証まわり');
  });

  it('note は引数全体を生の文字列として保持する', () => {
    const command = parse('note リフレッシュトークンの設計も含む');

    expect(command.rest).toBe('リフレッシュトークンの設計も含む');
  });

  it('引用符で囲まれた部分を 1 トークンとして扱う', () => {
    const command = parse('task add "認証 API 実装"');

    expect(command.args).toEqual(['認証 API 実装']);
  });

  it('シングルクォートも 1 トークンとして扱う', () => {
    const command = parse("task add '認証 API'");

    expect(command.args).toEqual(['認証 API']);
  });

  it('-- で始まるトークンをフラグとして位置引数から除外する', () => {
    const command = parse('task list --all');

    expect(command.args).toEqual([]);
    expect(command.flags).toEqual({ all: true });
  });

  it('値を伴うフラグは値を取り込む', () => {
    const command = parse('show 2026-08-12 --out /tmp/a.csv');

    expect(command.args).toEqual(['2026-08-12']);
    expect(command.flags).toEqual({ out: '/tmp/a.csv' });
  });

  it('コマンド名の大文字小文字を区別しない', () => {
    expect(parse('STOP').name).toBe('stop');
  });

  it('余分な空白を無視する', () => {
    const command = parse('   start    2   ');

    expect(command.name).toBe('start');
    expect(command.args).toEqual(['2']);
  });

  it('未知のコマンドは UnknownCommand を返す', () => {
    const result = router.parse('strat 1');

    expect(result).toEqual({
      ok: false,
      error: { kind: 'UnknownCommand', input: 'strat' },
    });
  });

  it('空入力は EmptyInput を返す', () => {
    const result = router.parse('   ');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('EmptyInput');
  });

  it('サブコマンドを省略した project も受け付ける(ハンドラが使い方を案内する)', () => {
    const command = parse('project');

    expect(command.name).toBe('project');
    expect(command.sub).toBeUndefined();
  });
});
