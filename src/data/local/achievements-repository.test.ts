import type { PuzzleCompletion } from '../repositories';

import { ACHIEVEMENTS, deriveAchievements } from './achievements-repository';

const done = (puzzleId: string, gridSize: 3 | 8, elapsedMs: number): PuzzleCompletion => ({
  puzzleId,
  gridSize,
  elapsedMs,
  completedAt: '2026-07-26T00:00:00.000Z',
});

describe('deriveAchievements', () => {
  it('reports zero progress for a new player', () => {
    for (const state of deriveAchievements([])) {
      expect(state.current).toBe(0);
      expect(state.unlocked).toBe(false);
    }
  });

  it('unlocks First Puzzle after one completion', () => {
    const first = deriveAchievements([done('a', 3, 1000)]).find((a) => a.key === 'first-puzzle');
    expect(first?.unlocked).toBe(true);
  });

  it('stays unlocked when the same board is replayed', () => {
    // The regression this log exists for: completions used to be read off the
    // live session row, which a replay overwrites — so finishing a puzzle and
    // starting it again re-locked every achievement it had earned.
    const afterReplay = deriveAchievements([done('a', 3, 1000)]);
    expect(afterReplay.find((a) => a.key === 'first-puzzle')?.unlocked).toBe(true);
  });

  it('does not let a replay of one board count as two puzzles completed', () => {
    // "Complete 50 puzzles" is about 50 puzzles, not 50 solves of one.
    const twice = deriveAchievements([done('a', 3, 1000), done('a', 3, 900)]);
    expect(twice.find((a) => a.key === 'collector')?.current).toBe(1);
  });

  it('counts the same puzzle at two sizes as two boards', () => {
    const both = deriveAchievements([done('a', 3, 1000), done('a', 8, 1000)]);
    expect(both.find((a) => a.key === 'collector')?.current).toBe(2);
  });

  it('lets a faster replay earn Speed Master', () => {
    // A single fast solve is the goal, so the attempt that finally beats ten
    // minutes counts even though the board was already finished once.
    const state = deriveAchievements([
      done('a', 3, 9 * 60 * 1000),
      done('a', 3, 11 * 60 * 1000),
    ]).find((a) => a.key === 'speed-master');
    expect(state?.unlocked).toBe(true);
  });

  it('counts only hard boards toward the hard-worker goal', () => {
    const state = deriveAchievements([done('a', 3, 1000), done('b', 8, 1000)]).find(
      (a) => a.key === 'hard-worker',
    );
    expect(state?.current).toBe(1);
  });

  it('counts a fast finish toward Speed Master, and a slow one not', () => {
    const fast = deriveAchievements([done('a', 3, 9 * 60 * 1000)]);
    expect(fast.find((a) => a.key === 'speed-master')?.unlocked).toBe(true);

    const slow = deriveAchievements([done('a', 3, 11 * 60 * 1000)]);
    expect(slow.find((a) => a.key === 'speed-master')?.unlocked).toBe(false);
  });

  it('never reports progress above the goal', () => {
    const many = Array.from({ length: 200 }, (_, i) => done(`p${i}`, 3, 1000));
    for (const state of deriveAchievements(many)) {
      expect(state.current).toBeLessThanOrEqual(state.goal);
    }
  });

  it('returns one state per definition, in definition order', () => {
    expect(deriveAchievements([]).map((a) => a.key)).toEqual(ACHIEVEMENTS.map((a) => a.key));
  });
});
