import type { PuzzleDefinition } from '@/game-engine';

import { getPuzzleImageModule, isUserPuzzle, resolvePuzzleImageSource } from './puzzle-assets';

function makePuzzle(overrides: Partial<PuzzleDefinition> = {}): PuzzleDefinition {
  return {
    id: 'x',
    title: 'X',
    image: { uri: 'asset://x', pixelSize: { width: 100, height: 100 } },
    gridSize: 4,
    seed: 's',
    revision: 1,
    ...overrides,
  };
}

describe('image source resolution', () => {
  it('resolves a bundled puzzle to its require module id', () => {
    const moduleId = getPuzzleImageModule('first-light');
    expect(moduleId).not.toBeNull();
    expect(resolvePuzzleImageSource(makePuzzle({ id: 'first-light' }))).toBe(moduleId);
  });

  it('resolves an imported puzzle to its file uri', () => {
    const puzzle = makePuzzle({
      id: 'user-1',
      image: { uri: 'file:///data/user/0/app/x.jpg', pixelSize: { width: 1, height: 1 } },
    });
    expect(resolvePuzzleImageSource(puzzle)).toBe('file:///data/user/0/app/x.jpg');
    expect(isUserPuzzle(puzzle)).toBe(true);
  });

  it('returns null when there is neither bundled art nor a file uri', () => {
    const puzzle = makePuzzle({
      id: 'ghost',
      image: { uri: 'asset://missing', pixelSize: { width: 1, height: 1 } },
    });
    expect(resolvePuzzleImageSource(puzzle)).toBeNull();
  });

  it('treats bundled puzzles as not user-deletable', () => {
    expect(isUserPuzzle(makePuzzle({ id: 'first-light' }))).toBe(false);
  });
});
