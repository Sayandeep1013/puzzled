import type { SQLiteDatabase } from 'expo-sqlite';

import { countLockedPieces, type GameSession, type PuzzleStatus } from '@/game-engine';

import type { ProgressRepository, PuzzleProgressSummary } from '../repositories';

interface SessionRow {
  session_json: string;
}

interface SummaryRow {
  puzzle_id: string;
  status: PuzzleStatus;
  locked_pieces: number;
  total_pieces: number;
  elapsed_ms: number;
  updated_at: string;
}

export class SQLiteProgressRepository implements ProgressRepository {
  constructor(private readonly database: SQLiteDatabase) {}

  async initialize(): Promise<void> {
    await this.database.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS puzzle_sessions (
        puzzle_id TEXT PRIMARY KEY NOT NULL,
        status TEXT NOT NULL,
        locked_pieces INTEGER NOT NULL,
        total_pieces INTEGER NOT NULL,
        elapsed_ms INTEGER NOT NULL,
        updated_at TEXT NOT NULL,
        session_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS puzzle_sessions_updated_at_idx
        ON puzzle_sessions(updated_at DESC);
    `);
  }

  async getSession(puzzleId: string): Promise<GameSession | null> {
    const row = await this.database.getFirstAsync<SessionRow>(
      'SELECT session_json FROM puzzle_sessions WHERE puzzle_id = ?',
      puzzleId,
    );

    return row ? (JSON.parse(row.session_json) as GameSession) : null;
  }

  async listSummaries(): Promise<PuzzleProgressSummary[]> {
    const rows = await this.database.getAllAsync<SummaryRow>(`
      SELECT puzzle_id, status, locked_pieces, total_pieces, elapsed_ms, updated_at
      FROM puzzle_sessions
      ORDER BY updated_at DESC
    `);

    return rows.map((row) => ({
      puzzleId: row.puzzle_id,
      status: row.status,
      lockedPieces: row.locked_pieces,
      totalPieces: row.total_pieces,
      elapsedMs: row.elapsed_ms,
      updatedAt: row.updated_at,
    }));
  }

  async saveSession(session: GameSession): Promise<void> {
    await this.database.runAsync(
      `
        INSERT INTO puzzle_sessions (
          puzzle_id, status, locked_pieces, total_pieces, elapsed_ms, updated_at, session_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(puzzle_id) DO UPDATE SET
          status = excluded.status,
          locked_pieces = excluded.locked_pieces,
          total_pieces = excluded.total_pieces,
          elapsed_ms = excluded.elapsed_ms,
          updated_at = excluded.updated_at,
          session_json = excluded.session_json
      `,
      session.puzzleId,
      session.status,
      countLockedPieces(session),
      session.pieces.length,
      session.elapsedMs,
      session.updatedAt,
      JSON.stringify(session),
    );
  }

  async deleteSession(puzzleId: string): Promise<void> {
    await this.database.runAsync('DELETE FROM puzzle_sessions WHERE puzzle_id = ?', puzzleId);
  }
}
