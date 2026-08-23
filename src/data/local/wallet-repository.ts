import type { SQLiteDatabase } from 'expo-sqlite';

import type { GridSize } from '@/game-engine';

import type {
  LedgerEntry,
  LedgerReason,
  NewLedgerEntry,
  Wallet,
  WalletRepository,
} from '../repositories';

interface LedgerRow {
  id: number;
  delta_coins: number;
  delta_hints: number;
  reason: LedgerReason;
  ref: string | null;
  created_at: string;
}

function rowToEntry(row: LedgerRow): LedgerEntry {
  return {
    id: row.id,
    deltaCoins: row.delta_coins,
    deltaHints: row.delta_hints,
    reason: row.reason,
    ref: row.ref,
    createdAt: row.created_at,
  };
}

/** Balances clamp at zero: a corrupt or replayed debit must not owe the player. */
export function sumLedger(entries: readonly LedgerEntry[]): Wallet {
  let coins = 0;
  let hints = 0;
  for (const item of entries) {
    coins += item.deltaCoins;
    hints += item.deltaHints;
  }
  return { coins: Math.max(0, coins), hints: Math.max(0, hints) };
}

/** Reward scales with piece count so a 10x10 is worth more than a 3x3. */
export function coinsForCompletion(gridSize: GridSize): number {
  return 10 + gridSize * gridSize;
}

/**
 * The daily bonus, and how it grows.
 *
 * Escalating rather than flat, because a flat bonus gives a player who returns
 * every day for a week exactly as much as one who shows up twice a month — the
 * point of a daily is the streak, so the streak has to be worth something.
 *
 * Capped, because it compounds against a currency that buys things. Without the
 * cap a long streak eventually pays more per day than finishing a 10x10 board,
 * which would make playing the game the slow way to earn.
 */
export const DAILY_BONUS = { base: 25, perDay: 15, cap: 100 } as const;

/**
 * Coins for today's claim, given how many consecutive days were claimed *before*
 * today. A first-ever claim passes 0 and gets `base`.
 */
export function dailyBonusFor(priorStreakDays: number): number {
  const days = Math.max(0, Math.floor(priorStreakDays));
  return Math.min(DAILY_BONUS.cap, DAILY_BONUS.base + days * DAILY_BONUS.perDay);
}

/** Paid once per achievement, the first time it is seen unlocked. */
export const ACHIEVEMENT_REWARD = 50;

export const STARTER_GRANT = {
  deltaCoins: 100,
  deltaHints: 5,
  reason: 'starter-grant' as const,
  ref: null,
};

export class SQLiteWalletRepository implements WalletRepository {
  constructor(private readonly database: SQLiteDatabase) {}

  async initialize(): Promise<void> {
    await this.database.execAsync(`
      CREATE TABLE IF NOT EXISTS ledger (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        delta_coins INTEGER NOT NULL,
        delta_hints INTEGER NOT NULL,
        reason TEXT NOT NULL,
        ref TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS ledger_created_at_idx ON ledger(created_at DESC);
    `);

    // Guard against re-granting on every app launch: only ever insert this once.
    const grant = await this.database.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) AS count FROM ledger WHERE reason = 'starter-grant'",
    );
    if (!grant || grant.count === 0) {
      await this.record(STARTER_GRANT);
    }
  }

  async balance(): Promise<Wallet> {
    return sumLedger(await this.history());
  }

  async record(entry: NewLedgerEntry): Promise<Wallet> {
    await this.database.runAsync(
      `INSERT INTO ledger (delta_coins, delta_hints, reason, ref, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      entry.deltaCoins,
      entry.deltaHints,
      entry.reason,
      entry.ref,
      new Date().toISOString(),
    );
    return this.balance();
  }

  async recordOnce(entry: NewLedgerEntry): Promise<Wallet> {
    if (entry.ref != null) {
      const existing = await this.database.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) AS count FROM ledger WHERE reason = ? AND ref = ?',
        entry.reason,
        entry.ref,
      );
      if (existing && existing.count > 0) {
        return this.balance();
      }
    }
    return this.record(entry);
  }

  async history(limit?: number): Promise<LedgerEntry[]> {
    const rows =
      limit === undefined
        ? await this.database.getAllAsync<LedgerRow>(
            'SELECT * FROM ledger ORDER BY created_at DESC, id DESC',
          )
        : await this.database.getAllAsync<LedgerRow>(
            'SELECT * FROM ledger ORDER BY created_at DESC, id DESC LIMIT ?',
            limit,
          );

    return rows.map(rowToEntry);
  }
}
