import type { SQLiteDatabase } from 'expo-sqlite';

import type { FavouritesRepository } from '../repositories';

export class SQLiteFavouritesRepository implements FavouritesRepository {
  constructor(private readonly database: SQLiteDatabase) {}

  async initialize(): Promise<void> {
    await this.database.execAsync(`
      CREATE TABLE IF NOT EXISTS favourites (
        puzzle_id TEXT PRIMARY KEY NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
  }

  async list(): Promise<string[]> {
    const rows = await this.database.getAllAsync<{ puzzle_id: string }>(
      'SELECT puzzle_id FROM favourites ORDER BY created_at DESC',
    );
    return rows.map((row) => row.puzzle_id);
  }

  async toggle(puzzleId: string): Promise<boolean> {
    if (await this.isFavourite(puzzleId)) {
      await this.database.runAsync('DELETE FROM favourites WHERE puzzle_id = ?', puzzleId);
      return false;
    }

    await this.database.runAsync(
      'INSERT INTO favourites (puzzle_id, created_at) VALUES (?, ?)',
      puzzleId,
      new Date().toISOString(),
    );
    return true;
  }

  async isFavourite(puzzleId: string): Promise<boolean> {
    const row = await this.database.getFirstAsync<{ puzzle_id: string }>(
      'SELECT puzzle_id FROM favourites WHERE puzzle_id = ?',
      puzzleId,
    );
    return row !== null;
  }
}
