import type { EdgeShape, GridSize, PieceEdges, Size } from './types';

import { createSeededRng } from './rng';

export function createEmptyEdgeGrid(gridSize: GridSize): PieceEdges[][] {
  return Array.from({ length: gridSize }, () =>
    Array.from({ length: gridSize }, () => ({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    })),
  );
}

/**
 * Generates complementary jigsaw edges.
 * Only right/bottom interior edges are random; neighbors receive the exact inverse.
 */
export function generateEdgeGrid(gridSize: GridSize, seed: string): PieceEdges[][] {
  const edges = createEmptyEdgeGrid(gridSize);
  const random = createSeededRng(`${seed}:edges`);

  const nextInterior = (): EdgeShape => (random() < 0.5 ? 1 : -1);

  for (let row = 0; row < gridSize; row += 1) {
    for (let column = 0; column < gridSize; column += 1) {
      if (column < gridSize - 1) {
        const shape = nextInterior();
        edges[row][column].right = shape;
        edges[row][column + 1].left = -shape as EdgeShape;
      }

      if (row < gridSize - 1) {
        const shape = nextInterior();
        edges[row][column].bottom = shape;
        edges[row + 1][column].top = -shape as EdgeShape;
      }
    }
  }

  return edges;
}

export function assertComplementaryEdges(edges: PieceEdges[][]): void {
  const gridSize = edges.length;

  for (let row = 0; row < gridSize; row += 1) {
    for (let column = 0; column < gridSize; column += 1) {
      const cell = edges[row][column];

      if (row === 0 && cell.top !== 0) {
        throw new Error(`Outer top edge must be flat at ${row}:${column}`);
      }
      if (column === 0 && cell.left !== 0) {
        throw new Error(`Outer left edge must be flat at ${row}:${column}`);
      }
      if (row === gridSize - 1 && cell.bottom !== 0) {
        throw new Error(`Outer bottom edge must be flat at ${row}:${column}`);
      }
      if (column === gridSize - 1 && cell.right !== 0) {
        throw new Error(`Outer right edge must be flat at ${row}:${column}`);
      }

      if (column < gridSize - 1 && cell.right !== -edges[row][column + 1].left) {
        throw new Error(`Horizontal edges are not complementary at ${row}:${column}`);
      }

      if (row < gridSize - 1 && cell.bottom !== -edges[row + 1][column].top) {
        throw new Error(`Vertical edges are not complementary at ${row}:${column}`);
      }
    }
  }
}

export function computeBoardSize(gridSize: GridSize, cellSize: number): Size {
  if (cellSize <= 0) {
    throw new RangeError('cellSize must be positive.');
  }

  return {
    width: gridSize * cellSize,
    height: gridSize * cellSize,
  };
}
