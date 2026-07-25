import type { PuzzleProgressSummary } from '../repositories';

import { ACHIEVEMENTS, deriveAchievements } from './achievements-repository';

const done = (puzzleId: string, gridSize: 3 | 8, elapsedMs: number): PuzzleProgressSummary => ({
  puzzleId,
  gridSize,
  status: 'completed',
  lockedPieces: gridSize * gridSize,
  totalPieces: gridSize * gridSize,
  elapsedMs,
  updatedAt: '2026-07-26T00:00:00.000Z',
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

  it('does not count an in-progress puzzle as complete', () => {
    const summaries: PuzzleProgressSummary[] = [
      { ...done('a', 3, 1000), status: 'in-progress', lockedPieces: 2 },
    ];
    const first = deriveAchievements(summaries).find((a) => a.key === 'first-puzzle');
    expect(first?.unlocked).toBe(false);
  });

  it('counts only hard boards toward the hard-worker goal', () => {
    const state = deriveAchievements([done('a', 3, 1000), done('b', 8, 1000)]).find(
      (a) => a.key === 'hard-worker',
    );
    expect(state?.current).toBe(1);
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
