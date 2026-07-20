import type { GameSession, PuzzleDefinition } from './types';

import { generatePuzzlePieces, type GeneratedPuzzle } from './generate';
import { createInitialPositions, type LayoutMode } from './layout';
import { createInitialSession } from './session';

export interface PlayablePuzzle {
  generated: GeneratedPuzzle;
  session: GameSession;
}

export interface CreatePlayablePuzzleOptions {
  puzzle: PuzzleDefinition;
  sessionId: string;
  now: string;
  cellSize?: number;
  layoutMode?: LayoutMode;
}

/**
 * One-call bootstrap used by the Game feature and integration tests.
 * Keeps screens free of generation/layout wiring details.
 */
export function createPlayablePuzzle({
  puzzle,
  sessionId,
  now,
  cellSize = 48,
  layoutMode = 'tray',
}: CreatePlayablePuzzleOptions): PlayablePuzzle {
  const generated = generatePuzzlePieces({ puzzle, cellSize });
  const initialPositions = createInitialPositions({
    pieces: generated.pieces,
    boardSize: generated.boardSize,
    mode: layoutMode,
    seed: puzzle.seed,
  });

  return {
    generated,
    session: createInitialSession({
      sessionId,
      puzzle,
      pieces: generated.pieces,
      initialPositions,
      now,
    }),
  };
}
