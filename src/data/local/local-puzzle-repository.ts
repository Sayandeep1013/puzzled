import type { PuzzleDefinition } from '@/game-engine';

import type { PuzzleRepository } from '../repositories';

const bundledPuzzles: PuzzleDefinition[] = [
  {
    id: 'first-light',
    title: 'First Light',
    image: {
      uri: 'asset://puzzles/first-light',
      pixelSize: { width: 1024, height: 1024 },
    },
    // 4×4 starter so drag/snap feel can be judged on a phone before 8–10 boards.
    gridSize: 4,
    seed: 'first-light-v1',
    revision: 1,
  },
];

function clonePuzzle(puzzle: PuzzleDefinition): PuzzleDefinition {
  return {
    ...puzzle,
    image: {
      ...puzzle.image,
      pixelSize: { ...puzzle.image.pixelSize },
    },
  };
}

export class LocalPuzzleRepository implements PuzzleRepository {
  async list(): Promise<PuzzleDefinition[]> {
    return bundledPuzzles.map(clonePuzzle);
  }

  async getById(puzzleId: string): Promise<PuzzleDefinition | null> {
    const puzzle = bundledPuzzles.find((candidate) => candidate.id === puzzleId);
    return puzzle ? clonePuzzle(puzzle) : null;
  }
}
