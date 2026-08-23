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

/** Player-controlled preferences. */
export interface AppSettings {
  sound: boolean;
  music: boolean;
  haptics: boolean;
  /** The faint cell grid under the board. Off is a cleaner, harder board. */
  showGrid: boolean;
  /**
   * How close a piece has to land before it clicks home.
   *
   * On is the generous default the game shipped with. Off tightens the catch
   * radius rather than removing it — a board with no snap at all is not a
   * harder jigsaw, it is an unfinishable one on a touchscreen.
   */
  snapAssist: boolean;
  /**
   * Chosen theme, as a `ThemeId` from `@/shared/themes`.
   *
   * Stored as a plain string rather than the union, so the data layer never
   * imports from `shared/` — and so a row written by a build that shipped a
   * theme this one does not know about is read back and discarded rather than
   * crashing (`themeById` falls back).
   */
  themeId: string;
}

export interface SettingsRepository {
  get(): Promise<AppSettings>;
  set(patch: Partial<AppSettings>): Promise<AppSettings>;
}

/** Coin/hint balance. Always derived by summing the ledger, never stored directly. */
export interface Wallet {
  coins: number;
  hints: number;
}

/** Why a ledger row exists. Extend rather than repurpose an existing reason. */
export type LedgerReason =
  | 'puzzle-complete'
  | 'daily-complete'
  | 'streak-bonus'
  | 'hint-spend'
  | 'hint-purchase'
  | 'achievement-unlock'
  | 'theme-unlock'
  | 'treasure-stop'
  | 'coin-purchase'
  | 'starter-grant';

export interface LedgerEntry {
  id: number;
  deltaCoins: number;
  deltaHints: number;
  reason: LedgerReason;
  /** Optional correlation id, e.g. the puzzle id that earned the reward. */
  ref: string | null;
  createdAt: string;
}

export type NewLedgerEntry = Omit<LedgerEntry, 'id' | 'createdAt'>;

/**
 * Append-only coin/hint ledger. The balance is never a mutable counter — it is
 * always the sum of every row — so a future server can reconcile without
 * guessing which side is authoritative.
 */
export interface WalletRepository {
  balance(): Promise<Wallet>;
  record(entry: NewLedgerEntry): Promise<Wallet>;
  /**
   * Records `entry` only if no existing ledger row shares the same `reason`
   * AND the same `ref` — otherwise a no-op that returns the current balance
   * unchanged. A null/undefined `ref` is never deduped (always recorded),
   * since dedup requires a concrete (reason, ref) identity to key on.
   */
  recordOnce(entry: NewLedgerEntry): Promise<Wallet>;
  history(limit?: number): Promise<LedgerEntry[]>;
}

/** One finished board, recorded the moment it was solved. */
export interface PuzzleCompletion {
  puzzleId: string;
  gridSize: GridSize;
  /** Play time for that solve, in ms. */
  elapsedMs: number;
  completedAt: string;
}

export type NewPuzzleCompletion = PuzzleCompletion;

/**
 * Append-only record of every puzzle ever finished.
 *
 * Completions used to be read off the live session row — `status === 'completed'`
 * on the one row per (puzzle, size). That row is overwritten the moment the same
 * board is replayed, so finishing a puzzle and starting it again *un-finished*
 * it: "Puzzles completed" fell back to zero, the Completed tab emptied, and
 * First Puzzle / Speed Master re-locked. The daily streak lost its mark the same
 * way. A player replaying their favourite puzzle is the most likely player there
 * is, so this was reachable by doing the obvious thing.
 *
 * Append-only for the same reason the wallet ledger is: history is a fact, and a
 * mutable counter derived from current state cannot represent it. Replays each
 * add a row rather than replacing one.
 */
export interface CompletionsRepository {
  /** Every completion, most recent first. */
  list(): Promise<PuzzleCompletion[]>;
  record(entry: NewPuzzleCompletion): Promise<void>;
  /** Remove every completion for a puzzle, e.g. when an imported photo is deleted. */
  deleteForPuzzle(puzzleId: string): Promise<void>;
}

/**
 * Puzzle ids the player has starred. Backed by a single-column table keyed
 * on `puzzleId`, so membership doubles as the favourite flag — no separate
 * boolean column to fall out of sync.
 */
export interface FavouritesRepository {
  list(): Promise<string[]>;
  /** Flips favourite state for `puzzleId` and returns the state AFTER the flip. */
  toggle(puzzleId: string): Promise<boolean>;
  isFavourite(puzzleId: string): Promise<boolean>;
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
