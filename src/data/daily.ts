import { createSeededRng } from '@/game-engine';

/** Local-time `YYYY-MM-DD`. Deliberately not UTC: the daily should roll over at
 *  the player's midnight, not Greenwich's. */
export function dateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function pickDailyPuzzle<T extends { id: string }>(
  puzzles: readonly T[],
  key: string,
): T | null {
  if (puzzles.length === 0) {
    return null;
  }
  const random = createSeededRng(`daily:${key}`);
  return puzzles[Math.floor(random() * puzzles.length)] ?? null;
}

/** Consecutive days ending today (or yesterday, if today is not yet played). */
export function streakFrom(playedKeys: readonly string[], today: string): number {
  const played = new Set(playedKeys);
  const cursor = new Date(`${today}T00:00:00`);
  if (!played.has(today)) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let streak = 0;
  while (played.has(dateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
