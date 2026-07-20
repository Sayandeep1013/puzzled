import { expectedPieceCount, generatePuzzlePieces } from './generate';
import { createInitialPositions } from './layout';
import type { PuzzleDefinition } from './types';

const puzzle: PuzzleDefinition = {
  id: 'first-light',
  title: 'First Light',
  image: {
    uri: 'asset://first-light',
    pixelSize: { width: 1600, height: 1200 },
  },
  gridSize: 8,
  seed: 'first-light-v1',
  revision: 1,
};

describe('puzzle generation', () => {
  it('builds one geometry and path per cell', () => {
    const generated = generatePuzzlePieces({ puzzle, cellSize: 64 });

    expect(generated.pieces).toHaveLength(expectedPieceCount(8));
    expect(Object.keys(generated.paths)).toHaveLength(64);
    expect(generated.boardSize).toEqual({ width: 512, height: 512 });
    expect(generated.pieces[0].id).toBe('0:0');
    expect(generated.pieces[0].solvedPosition).toEqual({ x: 0, y: 0 });
    expect(generated.pieces.at(-1)?.id).toBe('7:7');
    expect(generated.pieces.at(-1)?.solvedPosition).toEqual({ x: 448, y: 448 });
  });

  it('is deterministic for the same puzzle seed and cell size', () => {
    const first = generatePuzzlePieces({ puzzle, cellSize: 50 });
    const second = generatePuzzlePieces({ puzzle, cellSize: 50 });
    expect(second.pieces).toEqual(first.pieces);
    expect(second.paths['3:4'].commands).toEqual(first.paths['3:4'].commands);
  });
});

describe('initial layout', () => {
  it('places tray pieces below the board', () => {
    const generated = generatePuzzlePieces({ puzzle, cellSize: 40 });
    const positions = createInitialPositions({
      pieces: generated.pieces,
      boardSize: generated.boardSize,
      mode: 'tray',
      seed: puzzle.seed,
    });

    expect(Object.keys(positions)).toHaveLength(64);
    for (const point of Object.values(positions)) {
      expect(point.y).toBeGreaterThan(generated.boardSize.height);
    }
  });

  it('scatters deterministically from the seed', () => {
    const generated = generatePuzzlePieces({ puzzle, cellSize: 40 });
    const first = createInitialPositions({
      pieces: generated.pieces,
      boardSize: generated.boardSize,
      mode: 'scatter',
      seed: puzzle.seed,
    });
    const second = createInitialPositions({
      pieces: generated.pieces,
      boardSize: generated.boardSize,
      mode: 'scatter',
      seed: puzzle.seed,
    });

    expect(second).toEqual(first);
  });
});
