import type { GameSession, GridSize, PuzzleDefinition, PuzzleStatus } from '@/game-engine';

export interface PuzzleProgressSummary {
  puzzleId: string;
  gridSize: GridSize;
  status: PuzzleStatus;
  lockedPieces: number;
  totalPieces: number;
  elapsedMs: number;
  updatedAt: string;
}

export interface PuzzleRepository {
  list(): Promise<PuzzleDefinition[]>;
  getById(puzzleId: string): Promise<PuzzleDefinition | null>;
}

/**
 * Progress is stored per (puzzle, grid size): the same image played at 4×4 and
 * 8×8 are independent boards with independent saves.
 */
export interface ProgressRepository {
  getSession(puzzleId: string, gridSize: GridSize): Promise<GameSession | null>;
  listSummaries(): Promise<PuzzleProgressSummary[]>;
  saveSession(session: GameSession): Promise<void>;
  deleteSession(puzzleId: string, gridSize: GridSize): Promise<void>;
}

const KEY_SEPARATOR = '::';

/** Row identity in the sessions table. Encodes puzzle + size in one column. */
export function sessionStorageKey(puzzleId: string, gridSize: GridSize): string {
  return `${puzzleId}${KEY_SEPARATOR}${gridSize}`;
}

/** Recover puzzle id and size from a storage key. Null for keys not in the new format. */
export function parseSessionStorageKey(key: string): { puzzleId: string; gridSize: number } | null {
  const separator = key.lastIndexOf(KEY_SEPARATOR);
  if (separator < 0) {
    return null;
  }

  const gridSize = Number(key.slice(separator + KEY_SEPARATOR.length));
  if (!Number.isInteger(gridSize)) {
    return null;
  }

  return { puzzleId: key.slice(0, separator), gridSize };
}
