import { Directory, File, Paths } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';

import type { PuzzleDefinition } from '@/game-engine';

import type { NewUserPuzzle, UserPuzzleRepository } from '../repositories';

import { fallbackPhotoTitle, isOpaqueFileName } from './photo-title';

/** Subfolder of the app document directory that holds imported puzzle images. */
const IMAGE_SUBDIR = 'user-puzzles';

interface UserPuzzleRow {
  id: string;
  title: string;
  uri: string;
  pixel_width: number;
  pixel_height: number;
  seed: string;
  created_at: string;
}

function rowToPuzzle(row: UserPuzzleRow): PuzzleDefinition {
  return {
    id: row.id,
    title: row.title,
    image: {
      uri: row.uri,
      pixelSize: { width: row.pixel_width, height: row.pixel_height },
    },
    // A default only; the player picks the actual size on the board.
    gridSize: 4,
    seed: row.seed,
    revision: 1,
  };
}

/** Runtime id — this is app state, not deterministic engine generation. */
function makeId(): string {
  return `user-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

function fileExtension(uri: string): string {
  const withoutQuery = uri.split('?')[0];
  const dot = withoutQuery.lastIndexOf('.');
  const ext = dot >= 0 ? withoutQuery.slice(dot + 1).toLowerCase() : '';
  return /^[a-z0-9]{1,5}$/.test(ext) ? ext : 'jpg';
}

function imageDirectory(): Directory {
  const dir = new Directory(Paths.document, IMAGE_SUBDIR);
  if (!dir.exists) {
    dir.create();
  }
  return dir;
}

/** Copy the picked file into app-owned storage and return its permanent uri. */
function copyIntoAppStorage(sourceUri: string, id: string): string {
  const destination = new File(imageDirectory(), `${id}.${fileExtension(sourceUri)}`);
  new File(sourceUri).copy(destination);
  return destination.uri;
}

function removeFromAppStorage(uri: string): void {
  try {
    const file = new File(uri);
    if (file.exists) {
      file.delete();
    }
  } catch {
    // A missing file is fine; the row is being removed regardless.
  }
}

export class SQLiteUserPuzzleRepository implements UserPuzzleRepository {
  constructor(private readonly database: SQLiteDatabase) {}

  async initialize(): Promise<void> {
    await this.database.execAsync(`
      CREATE TABLE IF NOT EXISTS user_puzzles (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        uri TEXT NOT NULL,
        pixel_width INTEGER NOT NULL,
        pixel_height INTEGER NOT NULL,
        seed TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS user_puzzles_created_at_idx
        ON user_puzzles(created_at DESC);
    `);

    await this.renameOpaqueTitles();
  }

  /**
   * Give already-imported photos a readable name.
   *
   * Titles are written once, at import, so naming them better only helped photos
   * imported *after* the fix — every photo already on the device kept the
   * `2c2550e4 36fc 4ab7...` it was given, on the board header, in Library and in
   * Puzzles. This rewrites those.
   *
   * Naturally idempotent, which is why it needs no migration flag: a renamed
   * title is no longer opaque, so a second pass matches nothing. Numbering runs
   * oldest-first so the names follow import order rather than whatever order
   * rows happen to come back in.
   */
  private async renameOpaqueTitles(): Promise<void> {
    const rows = await this.database.getAllAsync<{ id: string; title: string }>(
      'SELECT id, title FROM user_puzzles ORDER BY created_at ASC',
    );

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      if (!isOpaqueFileName(row.title)) {
        continue;
      }
      // Numbered by position among *all* imports, so the third photo imported is
      // "My photo 3" whether or not the first two needed renaming.
      await this.database.runAsync(
        'UPDATE user_puzzles SET title = ? WHERE id = ?',
        fallbackPhotoTitle(index),
        row.id,
      );
    }
  }

  async list(): Promise<PuzzleDefinition[]> {
    const rows = await this.database.getAllAsync<UserPuzzleRow>(
      'SELECT * FROM user_puzzles ORDER BY created_at DESC',
    );
    return rows.map(rowToPuzzle);
  }

  async getById(puzzleId: string): Promise<PuzzleDefinition | null> {
    const row = await this.database.getFirstAsync<UserPuzzleRow>(
      'SELECT * FROM user_puzzles WHERE id = ?',
      puzzleId,
    );
    return row ? rowToPuzzle(row) : null;
  }

  async add(input: NewUserPuzzle): Promise<PuzzleDefinition> {
    const id = makeId();
    const seed = `${id}-seed`;
    const createdAt = new Date().toISOString();
    // Copy first: if the file copy throws, no orphan row is written.
    const storedUri = copyIntoAppStorage(input.sourceUri, id);

    await this.database.runAsync(
      `INSERT INTO user_puzzles (id, title, uri, pixel_width, pixel_height, seed, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      id,
      input.title,
      storedUri,
      Math.round(input.pixelSize.width),
      Math.round(input.pixelSize.height),
      seed,
      createdAt,
    );

    return rowToPuzzle({
      id,
      title: input.title,
      uri: storedUri,
      pixel_width: Math.round(input.pixelSize.width),
      pixel_height: Math.round(input.pixelSize.height),
      seed,
      created_at: createdAt,
    });
  }

  async remove(puzzleId: string): Promise<void> {
    const row = await this.database.getFirstAsync<{ uri: string }>(
      'SELECT uri FROM user_puzzles WHERE id = ?',
      puzzleId,
    );
    await this.database.runAsync('DELETE FROM user_puzzles WHERE id = ?', puzzleId);
    if (row) {
      removeFromAppStorage(row.uri);
    }
  }
}
