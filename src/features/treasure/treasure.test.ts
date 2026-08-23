import { pickDailyPuzzle, type PuzzleCompletion } from '@/data';

import {
  TREASURE_LOOKBACK_DAYS,
  TREASURE_STOPS,
  treasureProgress,
  treasureRewardForStop,
} from './treasure';

const POOL = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];

/** A completion of whatever puzzle *was* that day's pick — what the hunt counts. */
function completedDaily(day: string): PuzzleCompletion {
  const pick = pickDailyPuzzle(POOL, day);
  if (!pick) {
    throw new Error('empty pool');
  }
  return {
    puzzleId: pick.id,
    gridSize: 4,
    elapsedMs: 60_000,
    // Midday, so the local-time date key is unambiguous.
    completedAt: `${day}T12:00:00.000Z`,
  };
}

describe('treasureRewardForStop', () => {
  it('rises across the week', () => {
    const rewards = [1, 2, 3, 4, 5, 6].map(treasureRewardForStop);
    for (let i = 1; i < rewards.length; i += 1) {
      expect(rewards[i]).toBeGreaterThan(rewards[i - 1]);
    }
  });

  it('makes the last stop worth showing up for', () => {
    // The step up is the entire reason to come back on day seven rather than
    // drifting off on day four.
    expect(treasureRewardForStop(TREASURE_STOPS)).toBeGreaterThan(
      treasureRewardForStop(TREASURE_STOPS - 1) * 2,
    );
  });

  it('pays nothing for a stop that is not on the map', () => {
    expect(treasureRewardForStop(0)).toBe(0);
    expect(treasureRewardForStop(-1)).toBe(0);
    expect(treasureRewardForStop(TREASURE_STOPS + 1)).toBe(0);
  });
});

describe('treasureProgress', () => {
  it('starts nobody on the map', () => {
    const progress = treasureProgress(POOL, [], '2026-08-23');
    expect(progress.streak).toBe(0);
    expect(progress.stop).toBe(0);
    expect(progress.doneToday).toBe(false);
  });

  it('counts consecutive days ending today', () => {
    const progress = treasureProgress(
      POOL,
      [completedDaily('2026-08-23'), completedDaily('2026-08-22'), completedDaily('2026-08-21')],
      '2026-08-23',
    );
    expect(progress.streak).toBe(3);
    expect(progress.stop).toBe(3);
    expect(progress.doneToday).toBe(true);
  });

  it('keeps yesterday’s streak alive before today is played', () => {
    // Opening the app in the morning must not look like the streak is gone.
    const progress = treasureProgress(
      POOL,
      [completedDaily('2026-08-22'), completedDaily('2026-08-21')],
      '2026-08-23',
    );
    expect(progress.streak).toBe(2);
    expect(progress.doneToday).toBe(false);
  });

  it('breaks the streak on a missed day', () => {
    const progress = treasureProgress(
      POOL,
      [completedDaily('2026-08-23'), completedDaily('2026-08-21')],
      '2026-08-23',
    );
    expect(progress.streak).toBe(1);
  });

  it('loops the map rather than running off the end', () => {
    const days = Array.from({ length: 9 }, (_, i) => {
      const date = new Date('2026-08-23T00:00:00');
      date.setDate(date.getDate() - i);
      return completedDaily(date.toISOString().slice(0, 10));
    });
    const progress = treasureProgress(POOL, days, '2026-08-23');
    expect(progress.streak).toBe(9);
    // Day 8 is stop 1 of the next lap, day 9 is stop 2.
    expect(progress.stop).toBe(2);
  });

  it('lands exactly on the last stop on day seven', () => {
    const days = Array.from({ length: TREASURE_STOPS }, (_, i) => {
      const date = new Date('2026-08-23T00:00:00');
      date.setDate(date.getDate() - i);
      return completedDaily(date.toISOString().slice(0, 10));
    });
    expect(treasureProgress(POOL, days, '2026-08-23').stop).toBe(TREASURE_STOPS);
  });

  it('ignores a completion of a puzzle that was not that day’s pick', () => {
    // Finishing any old puzzle is not finishing the challenge.
    const notThePick = POOL.map((p) => p.id).find(
      (id) => id !== pickDailyPuzzle(POOL, '2026-08-23')?.id,
    );
    const progress = treasureProgress(
      POOL,
      [
        {
          puzzleId: notThePick as string,
          gridSize: 4,
          elapsedMs: 1000,
          completedAt: '2026-08-23T12:00:00.000Z',
        },
      ],
      '2026-08-23',
    );
    expect(progress.streak).toBe(0);
  });

  it('survives an empty pool rather than throwing', () => {
    // Before the catalog loads there is nothing to pick, and the screen still
    // has to render.
    expect(treasureProgress([], [completedDaily('2026-08-23')], '2026-08-23').streak).toBe(0);
  });

  it('looks back far enough to cover any real streak', () => {
    expect(TREASURE_LOOKBACK_DAYS).toBeGreaterThan(TREASURE_STOPS * 4);
  });
});
