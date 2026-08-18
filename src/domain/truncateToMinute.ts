/**
 * 秒・ミリ秒を切り捨てて分単位に揃えた Date を返す。
 *
 * 分割の前に切り捨てるためにこの関数が要る。セグメントごとに独立して秒を切り捨てると、
 * 誤差がセグメント数だけ累積し、分割後の合計が分割前と一致しなくなる。
 */
export function truncateToMinute(d: Date): Date {
  const truncated = new Date(d);
  truncated.setSeconds(0, 0);
  return truncated;
}
