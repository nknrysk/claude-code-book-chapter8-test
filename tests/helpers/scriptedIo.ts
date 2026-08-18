import type { ReplIo } from '../../src/repl/ReplIo.js';

/**
 * ReplIo の差し替え実装。入力列を与え、出力を収集する。
 * 入力を使い切ったら null を返し、Ctrl-D(入力の終端)と同じ状態を作る。
 */
export class ScriptedIo implements ReplIo {
  readonly outputs: string[] = [];
  readonly prompts: string[] = [];
  private index = 0;

  /**
   * @param inputs - 流し込む入力行
   * @param onAnswer - 入力を返す直前に呼ばれる。テストが入力ごとの時刻を進めるために使う
   */
  constructor(
    private readonly inputs: (string | null)[],
    private readonly onAnswer?: (index: number) => void
  ) {}

  async question(prompt: string): Promise<string | null> {
    this.prompts.push(prompt);
    if (this.index >= this.inputs.length) return null;

    const line = this.inputs[this.index];
    this.onAnswer?.(this.index);
    this.index += 1;
    return line;
  }

  write(text: string): void {
    this.outputs.push(text);
  }

  onSigint(): void {
    // シナリオテストではシグナルを送らない
  }

  close(): void {
    // 差し替え実装では閉じる対象を持たない
  }

  /** 収集した出力を 1 つの文字列として返す(文言の検証に使う) */
  text(): string {
    return this.outputs.join('\n');
  }
}
