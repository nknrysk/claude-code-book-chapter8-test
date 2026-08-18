const ESC = '\u001b[';
const RESET = `${ESC}0m`;

const CODES = {
  cyan: 36,
  green: 32,
  yellow: 33,
  red: 31,
  gray: 90,
} as const;

export type ColorName = keyof typeof CODES;

/**
 * ANSI エスケープで色を付ける。非 TTY(パイプ・テストの差し替え IO)では素通しする。
 * 色情報が混じった文字列を E2E テストで比較したくないため、判定は都度行う。
 */
export function colorize(text: string, color: ColorName): string {
  if (!isColorEnabled()) return text;
  return `${ESC}${CODES[color]}m${text}${RESET}`;
}

export const cyan = (text: string): string => colorize(text, 'cyan');
export const green = (text: string): string => colorize(text, 'green');
export const yellow = (text: string): string => colorize(text, 'yellow');
export const red = (text: string): string => colorize(text, 'red');
export const gray = (text: string): string => colorize(text, 'gray');

function isColorEnabled(): boolean {
  return process.stdout.isTTY === true;
}
