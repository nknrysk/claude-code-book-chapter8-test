import { rename, writeFile } from 'node:fs/promises';

/**
 * 一時ファイルへ書き出してから rename する。処理中の異常終了でも既存ファイルが壊れない。
 *
 * 一時ファイルは対象と同じディレクトリに作る。/tmp を経由すると別ファイルシステムに
 * なり得て、rename の原子性が失われる。
 *
 * mode は writeFile の時点で指定する。作成後に chmod する実装では、
 * その隙間に他ユーザーが読める瞬間が生まれる。
 */
export async function atomicWrite(
  target: string,
  content: string,
  mode: number
): Promise<void> {
  const temporary = `${target}.tmp.${process.pid}`;
  await writeFile(temporary, content, { mode, encoding: 'utf8' });
  await rename(temporary, target);
}
