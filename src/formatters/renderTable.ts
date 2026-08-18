import {
  displayWidth,
  padEndToWidth,
  padStartToWidth,
} from './displayWidth.js';

export interface TableColumn {
  header: string;
  /** 既定は左詰め。数値列のみ右詰めにする */
  align?: 'left' | 'right';
}

export interface TableOptions {
  /** 行頭に付ける字下げ */
  indent?: string;
  /** 列間の区切り */
  gap?: string;
  /** ヘッダ行を出力するか。列名を持たない整列(タスク別小計)では false にする */
  showHeader?: boolean;
}

/**
 * 列幅を内容に応じて決めた表を組み立てる。
 *
 * 幅は文字数ではなく displayWidth(East Asian Width) で算出する。
 * タスク名・備考に日本語が入るため、文字数で揃えると桁が崩れる。
 *
 * @returns ヘッダ行を含む行の配列。呼び出し側が色付けや出力を行う
 */
export function renderTable(
  columns: TableColumn[],
  rows: string[][],
  options: TableOptions = {}
): string[] {
  const indent = options.indent ?? '';
  const gap = options.gap ?? '  ';

  const widths = columns.map((column, index) => {
    const cells = rows.map((row) => row[index] ?? '');
    return Math.max(
      displayWidth(column.header),
      ...cells.map((cell) => displayWidth(cell))
    );
  });

  const renderRow = (cells: string[]): string =>
    indent +
    columns
      .map((column, index) => {
        const cell = cells[index] ?? '';
        return column.align === 'right'
          ? padStartToWidth(cell, widths[index])
          : padEndToWidth(cell, widths[index]);
      })
      .join(gap)
      .trimEnd();

  const body = rows.map(renderRow);
  if (options.showHeader === false) return body;
  return [renderRow(columns.map((column) => column.header)), ...body];
}
