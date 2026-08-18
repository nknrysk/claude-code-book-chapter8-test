/**
 * コマンドの静的定義。CommandRouter のディスパッチと help の表示を
 * この 1 つの定義から導出する。説明文とディスパッチ先を別々に持つと、
 * コマンド追加時に help の更新漏れが生じる。
 */
export interface CommandSpec {
  name: string;
  /** project / task のみ持つサブコマンド */
  sub?: string;
  /** 1行説明。help の一覧表示に使う */
  summary: string;
  usage: string;
  /** help <コマンド名> で表示する使用例 */
  examples: string[];
}

/** MVP(P0) で提供するコマンド。add / edit / export / archive は P1 で追加する */
export const COMMAND_SPECS: CommandSpec[] = [
  {
    name: 'project',
    sub: 'add',
    summary: 'プロジェクトを登録する',
    usage: 'project add <名前>',
    examples: ['project add myproj'],
  },
  {
    name: 'project',
    sub: 'list',
    summary: '登録済みプロジェクトを一覧する',
    usage: 'project list',
    examples: ['project list'],
  },
  {
    name: 'use',
    summary: '作業対象プロジェクトを切り替える',
    usage: 'use <プロジェクト>',
    examples: ['use myproj'],
  },
  {
    name: 'task',
    sub: 'add',
    summary: '現在のプロジェクト配下にタスクを登録する',
    usage: 'task add <名前>',
    examples: ['task add 認証API実装'],
  },
  {
    name: 'task',
    sub: 'list',
    summary: 'タスクを最近使った順に一覧する',
    usage: 'task list',
    examples: ['task list'],
  },
  {
    name: 'start',
    summary: '計測を開始する',
    usage: 'start <番号|名前> [備考]',
    examples: ['start 1', 'start 認証API JWT の検証まわり'],
  },
  {
    name: 'stop',
    summary: '計測を終了してエントリを確定する',
    usage: 'stop',
    examples: ['stop'],
  },
  {
    name: 'resume',
    summary: '直前に確定したエントリと同じタスクで再開する',
    usage: 'resume',
    examples: ['resume'],
  },
  {
    name: 'note',
    summary: '計測中のエントリに備考を設定する(上書き)',
    usage: 'note <テキスト>',
    examples: ['note リフレッシュトークンの設計も含む'],
  },
  {
    name: 'show',
    summary: '1日の作業実績とタスク別小計を表示する',
    usage: 'show [YYYY-MM-DD]',
    examples: ['show', 'show 2026-08-12'],
  },
  {
    name: 'help',
    summary: 'コマンド一覧 / コマンドの詳細を表示する',
    usage: 'help [コマンド名]',
    examples: ['help', 'help start'],
  },
  {
    name: 'exit',
    summary: 'timelog を終了する(計測中は中止して stop を促す)',
    usage: 'exit',
    examples: ['exit'],
  },
];

/** サブコマンドを持つコマンド名(パース時にサブコマンドを切り出す対象) */
export const COMMANDS_WITH_SUB = new Set(
  COMMAND_SPECS.filter((spec) => spec.sub !== undefined).map(
    (spec) => spec.name
  )
);

export function findSpecs(name: string): CommandSpec[] {
  return COMMAND_SPECS.filter((spec) => spec.name === name);
}

export function isKnownCommand(name: string): boolean {
  return COMMAND_SPECS.some((spec) => spec.name === name);
}
