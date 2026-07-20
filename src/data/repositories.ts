import type { GameSession, GridSize, PuzzleDefinition, PuzzleStatus, Size } from '@/game-engine';

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

/** A gallery image the player imported, before it is persisted. */
export interface NewUserPuzzle {
  title: string;
  /** Source uri from the picker; the repository copies it into app storage. */
  sourceUri: string;
  pixelSize: Size;
}

/**
 * Puzzles the player created from their own photos. Images are copied into
 * app-owned storage so they survive the picker's temporary cache being cleared.
 */
export interface UserPuzzleRepository {
  list(): Promise<PuzzleDefinition[]>;
  getById(puzzleId: string): Promise<PuzzleDefinition | null>;
  add(input: NewUserPuzzle): Promise<PuzzleDefinition>;
  remove(puzzleId: string): Promise<void>;
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
  /** Remove every saved size for a puzzle, e.g. when the puzzle is deleted. */
  deleteSessionsForPuzzle(puzzleId: string): Promise<void>;
}

const KEY_SEPARATOR = '::';

/** Row identity in the sessions table. Encodes puzzle + size in one column. */
export function sessionStorageKey(puzzleId: string, gridSize: GridSize): string {
  return `${puzzleId}${KEY_SEPARATOR}${gridSize}`;
}

/** SQL LIKE pattern matching every size of one puzzle. */
export function sessionStorageKeyPrefix(puzzleId: string): string {
  return `${puzzleId}${KEY_SEPARATOR}`;
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
