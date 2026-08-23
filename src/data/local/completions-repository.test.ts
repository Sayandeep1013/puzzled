import type { PuzzleCompletion } from '../repositories';

import { latestPerBoard, parseCompletionRows } from './completions-repository';

const entry = (
  puzzleId: string,
  gridSize: PuzzleCompletion['gridSize'],
  completedAt: string,
  elapsedMs = 1000,
): PuzzleCompletion => ({ puzzleId, gridSize, elapsedMs, completedAt });

describe('latestPerBoard', () => {
  it('keeps one entry per (puzzle, size)', () => {
    const completions = [
      entry('a', 4, '2026-08-03T00:00:00.000Z'),
      entry('a', 4, '2026-08-01T00:00:00.000Z'),
      entry('a', 8, '2026-08-02T00:00:00.000Z'),
      entry('b', 4, '2026-07-30T00:00:00.000Z'),
    ];
    expect(latestPerBoard(completions).map((c) => `${c.puzzleId}:${c.gridSize}`)).toEqual([
      'a:4',
      'a:8',
      'b:4',
    ]);
  });

  it('keeps the newest of a repeated board, given newest-first input', () => {
    const completions = [
      entry('a', 4, '2026-08-03T00:00:00.000Z', 500),
      entry('a', 4, '2026-08-01T00:00:00.000Z', 900),
    ];
    expect(latestPerBoard(completions)).toHaveLength(1);
    expect(latestPerBoard(completions)[0].elapsedMs).toBe(500);
  });

  it('treats the same puzzle at two sizes as two boards', () => {
    // Progress is stored per (puzzle, size), so a 4x4 and an 8x8 of the same
    // image are genuinely different boards to finish.
    const completions = [
      entry('a', 4, '2026-08-03T00:00:00.000Z'),
      entry('a', 8, '2026-08-02T00:00:00.000Z'),
    ];
    expect(latestPerBoard(completions)).toHaveLength(2);
  });

  it('preserves order and handles an empty log', () => {
    expect(latestPerBoard([])).toEqual([]);
  });
});

describe('parseCompletionRows', () => {
  it('maps rows onto completions', () => {
    expect(
      parseCompletionRows([
        {
          puzzle_id: 'first-light',
          grid_size: 4,
          elapsed_ms: 12_000,
          completed_at: '2026-08-03T00:00:00.000Z',
        },
      ]),
    ).toEqual([
      {
        puzzleId: 'first-light',
        gridSize: 4,
        elapsedMs: 12_000,
        completedAt: '2026-08-03T00:00:00.000Z',
      },
    ]);
  });

  it('skips a size this build cannot play rather than crashing the screen', () => {
    const rows = [
      { puzzle_id: 'a', grid_size: 4, elapsed_ms: 1, completed_at: 'x' },
      { puzzle_id: 'b', grid_size: 12, elapsed_ms: 1, completed_at: 'x' },
      { puzzle_id: 'c', grid_size: 0, elapsed_ms: 1, completed_at: 'x' },
    ];
    expect(parseCompletionRows(rows).map((c) => c.puzzleId)).toEqual(['a']);
  });
});
