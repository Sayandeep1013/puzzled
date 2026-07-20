import type { GameSession, PuzzleDefinition, PuzzleStatus } from '@/game-engine';

export interface PuzzleProgressSummary {
  puzzleId: string;
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

export interface ProgressRepository {
  getSession(puzzleId: string): Promise<GameSession | null>;
  listSummaries(): Promise<PuzzleProgressSummary[]>;
  saveSession(session: GameSession): Promise<void>;
  deleteSession(puzzleId: string): Promise<void>;
}
