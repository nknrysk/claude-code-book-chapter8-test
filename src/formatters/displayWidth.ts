/**
 * East Asian Width を考慮した表示桁数を返す(全角 2 桁・半角 1 桁)。
 *
 * 表の列幅を String#length で決めると、日本語を含む列だけ幅が足りずに桁が崩れる。
 * 完全な Unicode 表ではなく、本プロダクトが扱う日本語・記号の範囲を対象とする。
 */
export function displayWidth(text: string): number {
  let width = 0;
  for (const char of text) {
    width += isWide(char) ? 2 : 1;
  }
  return width;
}

/**
 * 表示幅が maxWidth に収まるよう切り詰め、切り詰めた場合は末尾に記号を付ける。
 *
 * @param ellipsis - 切り詰めを示す記号。この記号の幅も maxWidth に含める
 */
export function truncateToWidth(
  text: string,
  maxWidth: number,
  ellipsis: string
): string {
  if (displayWidth(text) <= maxWidth) return text;

  const limit = maxWidth - displayWidth(ellipsis);
  let width = 0;
  let result = '';
  for (const char of text) {
    const next = width + (isWide(char) ? 2 : 1);
    if (next > limit) break;
    result += char;
    width = next;
  }
  return result + ellipsis;
}

/** 表示幅が width になるよう右側を空白で埋める */
export function padEndToWidth(text: string, width: number): string {
  const padding = width - displayWidth(text);
  return padding > 0 ? text + ' '.repeat(padding) : text;
}

/** 表示幅が width になるよう左側を空白で埋める */
export function padStartToWidth(text: string, width: number): string {
  const padding = width - displayWidth(text);
  return padding > 0 ? ' '.repeat(padding) + text : text;
}

function isWide(char: string): boolean {
  const code = char.codePointAt(0);
  if (code === undefined) return false;
  return (
    (code >= 0x1100 && code <= 0x115f) || // ハングル字母
    (code >= 0x2e80 && code <= 0x303e) || // CJK 部首・記号(全角の約物を含む)
    (code >= 0x3041 && code <= 0x33ff) || // かな・互換文字
    (code >= 0x3400 && code <= 0x4dbf) || // CJK 拡張A
    (code >= 0x4e00 && code <= 0x9fff) || // CJK 統合漢字
    (code >= 0xa000 && code <= 0xa4cf) || // イ文字
    (code >= 0xac00 && code <= 0xd7a3) || // ハングル音節
    (code >= 0xf900 && code <= 0xfaff) || // CJK 互換漢字
    (code >= 0xfe30 && code <= 0xfe6f) || // CJK 互換形・小字形
    (code >= 0xff00 && code <= 0xff60) || // 全角英数・記号
    (code >= 0xffe0 && code <= 0xffe6) // 全角通貨記号
  );
}
