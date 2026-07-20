import {
  isSupportedGridSize,
  MAX_GRID_SIZE,
  MIN_GRID_SIZE,
  SUPPORTED_GRID_SIZES,
} from './constants';
import { assertComplementaryEdges, generateEdgeGrid } from './edges';
import { expectedPieceCount, generatePuzzlePieces } from './generate';
import { cellSizeForGrid, createInitialPositions } from './layout';
import type { GridSize, PuzzleDefinition } from './types';

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

describe('grid size support', () => {
  it('accepts only supported sizes', () => {
    expect(SUPPORTED_GRID_SIZES).toEqual([3, 4, 5, 6, 7, 8, 9, 10]);
    expect(isSupportedGridSize(4)).toBe(true);
    expect(isSupportedGridSize(7)).toBe(true);
    expect(isSupportedGridSize(MIN_GRID_SIZE)).toBe(true);
    expect(isSupportedGridSize(MAX_GRID_SIZE)).toBe(true);
    expect(isSupportedGridSize(2)).toBe(false);
    expect(isSupportedGridSize(11)).toBe(false);
    expect(isSupportedGridSize(6.5)).toBe(false);
  });

  it('keeps 4×4 at its verified cell size and shrinks larger grids monotonically', () => {
    expect(cellSizeForGrid(4)).toBe(72);
    for (let i = 1; i < SUPPORTED_GRID_SIZES.length; i += 1) {
      expect(cellSizeForGrid(SUPPORTED_GRID_SIZES[i])).toBeLessThanOrEqual(
        cellSizeForGrid(SUPPORTED_GRID_SIZES[i - 1]),
      );
    }
  });

  it.each([...SUPPORTED_GRID_SIZES])('generates a complete, mating board at %i×%i', (gridSize) => {
    const sized: PuzzleDefinition = { ...puzzle, gridSize };
    const generated = generatePuzzlePieces({ puzzle: sized, cellSize: cellSizeForGrid(gridSize) });

    // One geometry and one path per cell.
    expect(generated.pieces).toHaveLength(expectedPieceCount(gridSize));
    expect(Object.keys(generated.paths)).toHaveLength(gridSize * gridSize);

    // Corners exist and land where expected.
    const cell = cellSizeForGrid(gridSize);
    expect(generated.pieces[0].id).toBe('0:0');
    expect(generated.pieces.at(-1)?.solvedPosition).toEqual({
      x: (gridSize - 1) * cell,
      y: (gridSize - 1) * cell,
    });

    // Edges are complementary and borders are flat — the generator's core invariant.
    const edges = generated.pieces.map((piece) => piece.edges);
    const grid = Array.from({ length: gridSize }, (_, row) =>
      edges.slice(row * gridSize, row * gridSize + gridSize),
    );
    expect(() => assertComplementaryEdges(grid)).not.toThrow();

    // Every tray piece starts below the board.
    const positions = createInitialPositions({
      pieces: generated.pieces,
      boardSize: generated.boardSize,
      mode: 'tray',
      seed: sized.seed,
    });
    for (const point of Object.values(positions)) {
      expect(point.y).toBeGreaterThanOrEqual(generated.boardSize.height);
    }
  });

  it('produces distinct edge layouts per size from the same seed', () => {
    const sizes: GridSize[] = [5, 7];
    const [five, seven] = sizes.map((gridSize) => generateEdgeGrid(gridSize, 'shared-seed'));
    expect(five).toHaveLength(5);
    expect(seven).toHaveLength(7);
  });
});
