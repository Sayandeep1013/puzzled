import type { SQLiteDatabase } from 'expo-sqlite';

import { isSupportedGridSize } from '@/game-engine';

import {
  parseSessionStorageKey,
  type CompletionsRepository,
  type NewPuzzleCompletion,
  type PuzzleCompletion,
} from '../repositories';

interface CompletionRow {
  puzzle_id: string;
  grid_size: number;
  elapsed_ms: number;
  completed_at: string;
}

interface LegacyCompletedSessionRow {
  puzzle_id: string;
  total_pieces: number;
  elapsed_ms: number;
  updated_at: string;
}

/** Rows → completions, skipping anything whose size this build cannot play. */
export function parseCompletionRows(rows: readonly CompletionRow[]): PuzzleCompletion[] {
  const completions: PuzzleCompletion[] = [];
  for (const row of rows) {
    if (!isSupportedGridSize(row.grid_size)) {
      continue; // A row from a build that supported a size this one does not.
    }
    completions.push({
      puzzleId: row.puzzle_id,
      gridSize: row.grid_size,
      elapsedMs: row.elapsed_ms,
      completedAt: row.completed_at,
    });
  }
  return completions;
}

/**
 * The newest completion per (puzzle, size).
 *
 * For "have I finished this board?" questions — the Completed tab, the daily's
 * played mark — where a replay should update the entry rather than add a second
 * one. Counting achievements deliberately does *not* use this: finishing the
 * same puzzle twice is two completions.
 *
 * Input must already be newest-first, which is the order `list()` returns.
 */
export function latestPerBoard(completions: readonly PuzzleCompletion[]): PuzzleCompletion[] {
  const seen = new Set<string>();
  const latest: PuzzleCompletion[] = [];
  for (const completion of completions) {
    const key = `${completion.puzzleId}::${completion.gridSize}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    latest.push(completion);
  }
  return latest;
}

export class SQLiteCompletionsRepository implements CompletionsRepository {
  constructor(private readonly database: SQLiteDatabase) {}

  async initialize(): Promise<void> {
    await this.database.execAsync(`
      CREATE TABLE IF NOT EXISTS puzzle_completions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        puzzle_id TEXT NOT NULL,
        grid_size INTEGER NOT NULL,
        elapsed_ms INTEGER NOT NULL,
        completed_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS puzzle_completions_completed_at_idx
        ON puzzle_completions(completed_at DESC);
    `);

    await this.backfillFromSessions();
  }

  /**
   * Carry existing installs' history across.
   *
   * Before this table, a completion existed only as `status = 'completed'` on
   * the live session row. Someone upgrading has that and nothing else, so
   * without this their stats and achievements would reset on first launch —
   * which is the exact failure this table exists to prevent, just delivered once
   * instead of on every replay.
   *
   * Guarded on the table being empty. A fresh install has no completed sessions
   * either, so the guard costs one `COUNT` and inserts nothing.
   */
  private async backfillFromSessions(): Promise<void> {
    const existing = await this.database.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM puzzle_completions',
    );
    if (existing && existing.count > 0) {
      return;
    }

    const rows = await this.database.getAllAsync<LegacyCompletedSessionRow>(
      `SELECT puzzle_id, total_pieces, elapsed_ms, updated_at
       FROM puzzle_sessions
       WHERE status = 'completed'`,
    );

    for (const row of rows) {
      // The sessions table keys on `puzzleId::gridSize`; sqrt of the piece count
      // is the fallback for rows written before that format, matching how
      // `SQLiteProgressRepository.listSummaries` reads them.
      const parsed = parseSessionStorageKey(row.puzzle_id);
      const gridSize = parsed?.gridSize ?? Math.round(Math.sqrt(row.total_pieces));
      if (!isSupportedGridSize(gridSize)) {
        continue;
      }
      await this.record({
        puzzleId: parsed?.puzzleId ?? row.puzzle_id,
        gridSize,
        elapsedMs: row.elapsed_ms,
        // `updatedAt` is when the row was last written, which for a completed
        // session is the completion. It is the only date these rows carry.
        completedAt: row.updated_at,
      });
    }
  }

  async list(): Promise<PuzzleCompletion[]> {
    const rows = await this.database.getAllAsync<CompletionRow>(
      `SELECT puzzle_id, grid_size, elapsed_ms, completed_at
       FROM puzzle_completions
       ORDER BY completed_at DESC, id DESC`,
    );
    return parseCompletionRows(rows);
  }

  async record(entry: NewPuzzleCompletion): Promise<void> {
    await this.database.runAsync(
      `INSERT INTO puzzle_completions (puzzle_id, grid_size, elapsed_ms, completed_at)
       VALUES (?, ?, ?, ?)`,
      entry.puzzleId,
      entry.gridSize,
      entry.elapsedMs,
      entry.completedAt,
    );
  }

  async deleteForPuzzle(puzzleId: string): Promise<void> {
    await this.database.runAsync('DELETE FROM puzzle_completions WHERE puzzle_id = ?', puzzleId);
  }
}
