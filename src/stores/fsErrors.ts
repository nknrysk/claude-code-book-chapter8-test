/**
 * ファイルが存在しないことによる I/O エラーかを判定する。
 *
 * 「存在しない = 未初期化」を正常系として扱う箇所が複数あり(マスタの初回読み込み、
 * 計測していない状態の current.json、未作成の月ファイル)、判定を 1 箇所に置く。
 */
export function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as NodeJS.ErrnoException).code === 'ENOENT'
  );
}
