import type { SQLiteDatabase } from 'expo-sqlite';

import type { AppSettings, SettingsRepository } from '../repositories';

export const DEFAULT_SETTINGS: AppSettings = {
  sound: true,
  music: true,
  haptics: true,
  themeId: 'meadow',
};

const KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof AppSettings)[];

/**
 * Which keys round-trip as `'1'`/`'0'` and which as their own text.
 *
 * The table was all booleans until the theme arrived. Deriving the split from
 * `DEFAULT_SETTINGS` at runtime keeps the two in step: add a key there and it
 * is stored correctly here without a second edit, which is the failure this
 * would otherwise invite.
 */
function isBooleanKey(key: keyof AppSettings): boolean {
  return typeof DEFAULT_SETTINGS[key] === 'boolean';
}

function serialise(key: keyof AppSettings, value: AppSettings[keyof AppSettings]): string {
  return isBooleanKey(key) ? (value ? '1' : '0') : String(value);
}

export interface SettingRow {
  key: string;
  value: string;
}

/**
 * Overlay a patch, ignoring keys explicitly set to `undefined`.
 *
 * Written out key by key rather than looped. `AppSettings` mixes booleans and a
 * string now, so an indexed write against the key union narrows its value type
 * to `never` and needs a cast to escape — and a cast here would silently accept
 * a new key going unhandled. Spelled out, adding one is a compile error.
 */
export function mergeSettings(current: AppSettings, patch: Partial<AppSettings>): AppSettings {
  return {
    // `??`, not `||`: `false` is a real value for a toggle.
    sound: patch.sound ?? current.sound,
    music: patch.music ?? current.music,
    haptics: patch.haptics ?? current.haptics,
    themeId: patch.themeId ?? current.themeId,
  };
}

/** Rows → settings, tolerating missing and unknown keys from older builds. */
export function parseSettingsRows(rows: readonly SettingRow[]): AppSettings {
  const stored = new Map(rows.map((row) => [row.key, row.value]));
  const asBoolean = (key: string, fallback: boolean): boolean => {
    const value = stored.get(key);
    return value === undefined ? fallback : value === '1';
  };
  const asText = (key: string, fallback: string): string => stored.get(key) ?? fallback;

  // Unknown keys are simply never read, so a row left by a superseded build
  // costs nothing and needs no filtering.
  return {
    sound: asBoolean('sound', DEFAULT_SETTINGS.sound),
    music: asBoolean('music', DEFAULT_SETTINGS.music),
    haptics: asBoolean('haptics', DEFAULT_SETTINGS.haptics),
    themeId: asText('themeId', DEFAULT_SETTINGS.themeId),
  };
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
        serialise(key, next[key]),
      );
    }
    return next;
  }
}
