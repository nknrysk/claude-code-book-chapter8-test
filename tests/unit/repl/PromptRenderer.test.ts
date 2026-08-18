import { describe, expect, it } from 'vitest';
import { PromptRenderer } from '../../../src/repl/PromptRenderer.js';
import { makeCurrentTimer } from '../../helpers/fixtures.js';

const renderer = new PromptRenderer();

describe('PromptRenderer', () => {
  it('プロジェクト未選択のときは [未選択] を表示する', () => {
    expect(
      renderer.render({ projectName: null }, null, new Date(2026, 7, 12, 9, 0))
    ).toBe('[未選択] > ');
  });

  it('計測していないときはプロジェクト名のみを表示する', () => {
    expect(
      renderer.render(
        { projectName: 'myproj' },
        null,
        new Date(2026, 7, 12, 9, 0)
      )
    ).toBe('[myproj] > ');
  });

  it('計測中はマーカー・タスク名・経過時間を表示する', () => {
    const timer = makeCurrentTimer({
      start: new Date(2026, 7, 12, 9, 12).toISOString(),
    });

    const prompt = renderer.render(
      { projectName: 'myproj' },
      timer,
      new Date(2026, 7, 12, 9, 35)
    );

    expect(prompt).toBe('[myproj] ▶ 認証API実装 00:23 > ');
  });

  it('経過時間は 1 時間を超えると HH:MM で桁上がりする', () => {
    const timer = makeCurrentTimer({
      start: new Date(2026, 7, 12, 9, 12).toISOString(),
    });

    expect(
      renderer.render(
        { projectName: 'myproj' },
        timer,
        new Date(2026, 7, 12, 10, 17)
      )
    ).toContain('01:05');
  });

  it('100 時間を超えても桁を伸ばして表示が崩れない', () => {
    const timer = makeCurrentTimer({
      start: new Date(2026, 7, 1, 0, 0).toISOString(),
    });

    expect(
      renderer.render(
        { projectName: 'myproj' },
        timer,
        new Date(2026, 7, 5, 4, 0)
      )
    ).toContain('100:00');
  });

  it('長いタスク名は 20 桁で切り詰めて … を付ける', () => {
    const timer = makeCurrentTimer({
      taskName: 'あいうえおかきくけこさしすせそたちつてと',
      start: new Date(2026, 7, 12, 9, 0).toISOString(),
    });

    const prompt = renderer.render(
      { projectName: 'myproj' },
      timer,
      new Date(2026, 7, 12, 9, 0)
    );

    expect(prompt).toContain('あいうえおかきくけ…');
    expect(prompt).not.toContain('たちつてと');
  });

  it('開始直後は 00:00 を表示する', () => {
    const timer = makeCurrentTimer({
      start: new Date(2026, 7, 12, 9, 0).toISOString(),
    });

    expect(
      renderer.render(
        { projectName: 'myproj' },
        timer,
        new Date(2026, 7, 12, 9, 0, 30)
      )
    ).toContain('00:00');
  });
});
