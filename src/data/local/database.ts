import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { SQLiteProgressRepository } from './sqlite-progress-repository';

export const DATABASE_NAME = 'puzzled.db';

/**
 * Opened once per app process and shared. The promise itself is cached so that
 * concurrent callers during startup await the same open + migration instead of
 * racing to create two connections.
 */
let connection: Promise<SQLiteDatabase> | null = null;

function connect(): Promise<SQLiteDatabase> {
  if (!connection) {
    connection = openDatabaseAsync(DATABASE_NAME)
      .then(async (database) => {
        await new SQLiteProgressRepository(database).initialize();
        return database;
      })
      .catch((error: unknown) => {
        // Allow a later call to retry rather than caching a rejected promise.
        connection = null;
        throw error;
      });
  }

  return connection;
}

export async function getProgressRepository(): Promise<SQLiteProgressRepository> {
  return new SQLiteProgressRepository(await connect());
}
