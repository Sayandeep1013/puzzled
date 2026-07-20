import type { GridSize, PieceGeometry, PuzzleDefinition, Size, SourceRect } from './types';

import { GENERATOR_ALGORITHM_VERSION } from './constants';
import { computeBoardSize, generateEdgeGrid } from './edges';
import { computeCellSourceRect, computeCenterCrop } from './coordinates';
import { makePieceId } from './ids';
import { buildPieceLocalPath, type PieceLocalPath } from './path';

export interface GeneratedPuzzle {
  algorithmVersion: number;
  puzzle: PuzzleDefinition;
  crop: SourceRect;
  cellSize: Size;
  boardSize: Size;
  pieces: PieceGeometry[];
  paths: Record<string, PieceLocalPath>;
}

export interface GeneratePuzzleOptions {
  puzzle: PuzzleDefinition;
  /** Logical board cell size in points. */
  cellSize: number;
}

export function generatePuzzlePieces({ puzzle, cellSize }: GeneratePuzzleOptions): GeneratedPuzzle {
  if (cellSize <= 0) {
    throw new RangeError('cellSize must be positive.');
  }

  const crop = computeCenterCrop(puzzle.image.pixelSize);
  const boardSize = computeBoardSize(puzzle.gridSize, cellSize);
  const cell: Size = { width: cellSize, height: cellSize };
  const edgeGrid = generateEdgeGrid(
    puzzle.gridSize,
    `${puzzle.seed}:v${GENERATOR_ALGORITHM_VERSION}`,
  );

  const pieces: PieceGeometry[] = [];
  const paths: Record<string, PieceLocalPath> = {};

  for (let row = 0; row < puzzle.gridSize; row += 1) {
    for (let column = 0; column < puzzle.gridSize; column += 1) {
      const id = makePieceId(row, column);
      const edges = edgeGrid[row][column];
      const geometry: PieceGeometry = {
        id,
        row,
        column,
        edges,
        sourceRect: computeCellSourceRect(crop, puzzle.gridSize, row, column),
        solvedPosition: {
          x: column * cellSize,
          y: row * cellSize,
        },
      };

      pieces.push(geometry);
      paths[id] = buildPieceLocalPath(edges, cell);
    }
  }

  return {
    algorithmVersion: GENERATOR_ALGORITHM_VERSION,
    puzzle,
    crop,
    cellSize: cell,
    boardSize,
    pieces,
    paths,
  };
}

export function expectedPieceCount(gridSize: GridSize): number {
  return gridSize * gridSize;
}
