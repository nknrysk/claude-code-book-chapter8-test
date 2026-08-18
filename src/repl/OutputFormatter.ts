import { gray, green, red, yellow } from '../formatters/ansi.js';
import { formatDuration } from '../formatters/formatDuration.js';
import type { CurrentTimer, Entry, Task } from '../types/entities.js';
import type { AppError } from '../types/errors.js';

/**
 * 利用者に見せる文言を組み立てる唯一の場所。
 *
 * メッセージをハンドラにベタ書きしないのは、E2E テストで文言を検証するためと、
 * 「何が問題か」と「次に何をすべきか」の両方を含めるという規約を 1 箇所で守るためである。
 */
export class OutputFormatter {
  success(text: string): string {
    return green(text);
  }

  warning(text: string): string {
    return yellow(`警告: ${text}`);
  }

  error(text: string): string {
    return red(text);
  }

  info(text: string): string {
    return text;
  }

  muted(text: string): string {
    return gray(text);
  }

  /** 想定内エラーの文言。switch の網羅性をコンパイラに検査させる */
  formatAppError(error: AppError): string {
    switch (error.kind) {
      case 'NoProjectSelected':
        return this.error(
          "プロジェクトが選択されていません。'use <プロジェクト名>' で選択してください"
        );
      case 'ProjectNotFound':
        return this.error(
          `プロジェクト '${error.input}' は登録されていません。` +
            (error.registered.length > 0
              ? `登録済み: ${error.registered.join(', ')}`
              : "'project add <名前>' で登録してください")
        );
      case 'DuplicateName':
        return this.error(
          `${labelOf(error.target)} '${error.name}' は既に登録されています。` +
            `'${error.target === 'project' ? 'project list' : 'task list'}' で確認してください`
        );
      case 'InvalidName':
        return this.error(
          error.reason === 'length'
            ? `${labelOf(error.target)}名は 1〜100 文字で指定してください`
            : `${labelOf(error.target)}名に制御文字は使用できません。文字を修正して再実行してください`
        );
      case 'IndexOutOfRange':
        return this.error(
          `番号 ${error.input} は範囲外です。` +
            (error.max > 0
              ? `1〜${error.max} の番号か、タスク名の一部を指定してください`
              : "'task add <名前>' でタスクを登録してください")
        );
      case 'NotFound':
        return this.error(
          `'${error.input}' に一致するタスクがありません。'task list' で一覧を確認してください`
        );
      case 'Ambiguous':
        return this.error(
          [
            `'${error.input}' に複数のタスクが一致します:`,
            ...error.candidates.map(
              (task: Task, index: number) => `  ${index + 1} ${task.name}`
            ),
            '番号で指定してください',
          ].join('\n')
        );
      case 'NotMeasuring':
        return this.error(
          "計測していません。'start <番号|名前>' で開始してください"
        );
      case 'NoResumeTarget':
        return this.error(
          "再開できるエントリがありません。'start <番号|名前>' で開始してください"
        );
      case 'TaskInUse':
        return this.error(
          `計測中のタスク '${error.taskName}' はアーカイブできません。'stop' してから実行してください`
        );
      case 'InvalidTimeRange':
        return this.error(
          `終了時刻(${timeOf(error.end)})が開始時刻(${timeOf(error.start)})より前です。` +
            '開始時刻より後の時刻を指定してください'
        );
      case 'ExportPathNotFound':
        return this.error(
          `出力先ディレクトリ '${error.dir}' が存在しません。作成してから再実行してください`
        );
      default: {
        const exhaustive: never = error;
        throw new Error(`未処理のエラー: ${JSON.stringify(exhaustive)}`);
      }
    }
  }

  unknownCommand(input: string): string {
    return this.error(
      `不明なコマンドです: '${input}'。'help' でコマンド一覧を確認できます`
    );
  }

  invalidDateFormat(input: string): string {
    return this.error(
      `日付 '${input}' の形式が不正です。'YYYY-MM-DD' の形式で指定してください`
    );
  }

  invalidTimeFormat(input: string): string {
    return this.error(
      `時刻 '${input}' の形式が不正です。'HH:MM' または 'YYYY-MM-DD HH:MM' で指定してください`
    );
  }

  missingArgument(usage: string): string {
    return this.error(`引数が足りません。使い方: ${usage}`);
  }

  measuringOnExit(taskName: string): string {
    return this.error(
      `${taskName} を計測中です。'stop' で終了してから exit してください`
    );
  }

  unexpectedError(error: unknown): string[] {
    const lines = [
      this.error(`予期しないエラーが発生しました: ${String(error)}`),
    ];
    if (error instanceof Error && error.stack !== undefined) {
      lines.push(this.muted(error.stack));
    }
    lines.push(this.info('記録は保存されています。続行できます'));
    return lines;
  }

  started(timer: CurrentTimer): string {
    return this.success(
      `計測を開始しました: ${timer.taskName} (${timeOf(timer.start)})`
    );
  }

  stopped(entries: Entry[]): string {
    const total = entries.reduce((sum, entry) => sum + entry.minutes, 0);
    const range = `${timeOf(entries[0].start)}-${timeOf(entries[entries.length - 1].end)}`;
    const split = entries.length > 1 ? ` / ${entries.length}件に分割` : '';
    return this.success(
      `計測を終了しました: ${entries[0].taskName} ${range} (${total}分${split})`
    );
  }

  noteSet(): string {
    return this.success('備考を設定しました');
  }

  projectAdded(name: string): string {
    return this.success(`プロジェクト ${name} を登録しました`);
  }

  projectSwitched(name: string): string {
    return this.success(`プロジェクトを ${name} に切り替えました`);
  }

  taskAdded(name: string): string {
    return this.success(`タスク ${name} を登録しました`);
  }

  emptyDailyReport(date: string): string {
    return this.info(
      `${date} の作業実績はありません。'start <番号|名前>' で計測を開始してください`
    );
  }

  /** 小計行など、時間を併記する表示に用いる */
  duration(minutes: number): string {
    return formatDuration(minutes, { spaced: true });
  }
}

function labelOf(target: 'project' | 'task'): string {
  return target === 'project' ? 'プロジェクト' : 'タスク';
}

/** ISO 8601 の時刻部分 "HH:MM" を取り出す */
function timeOf(iso: string): string {
  return iso.slice(11, 16);
}
