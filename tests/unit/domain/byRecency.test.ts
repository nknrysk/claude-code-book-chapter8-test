import { describe, expect, it } from 'vitest';
import { byRecency } from '../../../src/domain/byRecency.js';
import { makeTask } from '../../helpers/fixtures.js';

describe('byRecency', () => {
  it('lastUsedAt の降順で並ぶ(最後に計測したタスクが先頭)', () => {
    const older = makeTask({
      id: 't_old',
      lastUsedAt: '2026-08-12T09:00:00+09:00',
    });
    const newer = makeTask({
      id: 't_new',
      lastUsedAt: '2026-08-12T10:00:00+09:00',
    });

    expect([older, newer].sort(byRecency).map((t) => t.id)).toEqual([
      't_new',
      't_old',
    ]);
  });

  it('未使用(lastUsedAt が null)のタスクは後ろに並ぶ', () => {
    const unused = makeTask({ id: 't_unused', lastUsedAt: null });
    const used = makeTask({
      id: 't_used',
      lastUsedAt: '2026-08-12T09:00:00+09:00',
    });

    expect([unused, used].sort(byRecency).map((t) => t.id)).toEqual([
      't_used',
      't_unused',
    ]);
  });

  it('未使用同士は createdAt の降順(新しいものが手前)', () => {
    const old = makeTask({
      id: 't_old',
      createdAt: '2026-08-01T09:00:00+09:00',
      lastUsedAt: null,
    });
    const recent = makeTask({
      id: 't_recent',
      createdAt: '2026-08-10T09:00:00+09:00',
      lastUsedAt: null,
    });

    expect([old, recent].sort(byRecency).map((t) => t.id)).toEqual([
      't_recent',
      't_old',
    ]);
  });

  it('lastUsedAt が同値なら createdAt の降順で決まる', () => {
    const usedAt = '2026-08-12T09:00:00+09:00';
    const old = makeTask({
      id: 't_old',
      createdAt: '2026-08-01T09:00:00+09:00',
      lastUsedAt: usedAt,
    });
    const recent = makeTask({
      id: 't_recent',
      createdAt: '2026-08-10T09:00:00+09:00',
      lastUsedAt: usedAt,
    });

    expect([old, recent].sort(byRecency).map((t) => t.id)).toEqual([
      't_recent',
      't_old',
    ]);
  });
});
