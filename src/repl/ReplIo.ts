import { createInterface, type Interface } from 'node:readline/promises';

/**
 * 入出力の抽象。readline を挟むことで、E2E テストでシナリオを流せる。
 */
export interface ReplIo {
  /** 1 行入力を受け取る。入力が終端(Ctrl-D / パイプの終わり)した場合は null を返す */
  question(prompt: string): Promise<string | null>;
  write(text: string): void;
  onSigint(handler: () => void): void;
  close(): void;
}

/**
 * node:readline/promises による実装。
 *
 * question() を呼んだ時点で読み始めるのではなく、'line' イベントを常時受け取って
 * 内部キューへ積む。起動シーケンス(ディレクトリ生成・マスタ読み込み・復帰フロー)の
 * 非同期処理の間にパイプ入力が流れきってしまい、最初の入力を取りこぼすのを防ぐ。
 */
export class ReadlineIo implements ReplIo {
  private readonly readline: Interface;

  /** 受信済みで未消費の入力行 */
  private readonly buffered: string[] = [];

  /** 入力待ちの解決関数。question() が待機中のときのみ非 null */
  private waiting: ((line: string | null) => void) | null = null;

  private isClosed = false;

  constructor() {
    this.readline = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: process.stdin.isTTY === true,
    });

    this.readline.on('line', (line) => {
      const waiting = this.waiting;
      if (waiting !== null) {
        this.waiting = null;
        waiting(line);
        return;
      }
      this.buffered.push(line);
    });

    this.readline.on('close', () => {
      this.isClosed = true;
      const waiting = this.waiting;
      if (waiting !== null) {
        this.waiting = null;
        waiting(null);
      }
    });
  }

  async question(prompt: string): Promise<string | null> {
    process.stdout.write(prompt);

    const buffered = this.buffered.shift();
    if (buffered !== undefined) return buffered;
    if (this.isClosed) return null;

    return new Promise<string | null>((resolve) => {
      this.waiting = resolve;
    });
  }

  write(text: string): void {
    process.stdout.write(`${text}\n`);
  }

  onSigint(handler: () => void): void {
    this.readline.on('SIGINT', handler);
  }

  close(): void {
    this.readline.close();
  }
}
