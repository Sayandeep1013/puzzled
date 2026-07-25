import type { SQLiteDatabase } from 'expo-sqlite';

import type { AppSettings, SettingsRepository } from '../repositories';

export const DEFAULT_SETTINGS: AppSettings = { sound: true, music: true, haptics: true };

const KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof AppSettings)[];

export interface SettingRow {
  key: string;
  value: string;
}

/** Overlay a patch, ignoring keys explicitly set to `undefined`. */
export function mergeSettings(current: AppSettings, patch: Partial<AppSettings>): AppSettings {
  const next = { ...current };
  for (const key of KEYS) {
    const value = patch[key];
    if (value !== undefined) {
      next[key] = value;
    }
  }
  return next;
}

/** Rows → settings, tolerating missing and unknown keys from older builds. */
export function parseSettingsRows(rows: readonly SettingRow[]): AppSettings {
  const next = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    if ((KEYS as string[]).includes(row.key)) {
      next[row.key as keyof AppSettings] = row.value === '1';
    }
  }
  return next;
}

export class SQLiteSettingsRepository implements SettingsRepository {
  constructor(private readonly database: SQLiteDatabase) {}

  async initialize(): Promise<void> {
    await this.database.execAsync(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `);
  }

  async get(): Promise<AppSettings> {
    const rows = await this.database.getAllAsync<SettingRow>('SELECT key, value FROM settings');
    return parseSettingsRows(rows);
  }

  async set(patch: Partial<AppSettings>): Promise<AppSettings> {
    const next = mergeSettings(await this.get(), patch);
    for (const key of KEYS) {
      await this.database.runAsync(
        `INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        key,
        next[key] ? '1' : '0',
      );
    }
    return next;
  }
}
