export interface Segment {
  start: Date;
  end: Date;
}

/**
 * 計測区間を日付境界(ローカルタイムの 00:00)で分割する。
 *
 * 分割回数に上限を設けない。金曜夜から月曜朝まで stop を押し忘れた場合は
 * 3 セグメントに分かれる。境界の数を特別扱いしないことで、この分岐を実装から消している。
 *
 * @returns 開始時刻の昇順に並んだセグメント。日跨ぎがなければ 1 件
 */
export function splitByDay(start: Date, end: Date): Segment[] {
  const segments: Segment[] = [];
  let cursor = start;

  while (cursor < end) {
    const boundary = startOfNextDay(cursor);
    const segmentEnd = boundary < end ? boundary : end;
    segments.push({ start: cursor, end: segmentEnd });
    cursor = segmentEnd;
  }

  // start === end(0分)の場合はループが 1 度も回らない。
  // 0 分のエントリも破棄しないため、単一セグメントとして返す
  return segments.length > 0 ? segments : [{ start, end }];
}

/**
 * その日の翌日 0 時を返す。
 * setDate / setHours を使うため、夏時間の切り替わりがある地域でも境界を正しく求められる。
 */
function startOfNextDay(d: Date): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + 1);
  next.setHours(0, 0, 0, 0);
  return next;
}
