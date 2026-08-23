import {
  coinsForCompletion,
  DAILY_BONUS,
  dailyBonusFor,
  STARTER_GRANT,
  sumLedger,
} from './wallet-repository';

const entry = (deltaCoins: number, deltaHints: number) => ({
  id: 0,
  deltaCoins,
  deltaHints,
  reason: 'puzzle-complete' as const,
  ref: null,
  createdAt: '2026-07-26T00:00:00.000Z',
});

describe('sumLedger', () => {
  it('returns a zero balance for an empty ledger', () => {
    expect(sumLedger([])).toEqual({ coins: 0, hints: 0 });
  });

  it('sums credits and debits', () => {
    expect(sumLedger([entry(100, 3), entry(-30, -1)])).toEqual({ coins: 70, hints: 2 });
  });

  it('never reports a negative balance even if the ledger over-debits', () => {
    expect(sumLedger([entry(10, 0), entry(-50, -5)])).toEqual({ coins: 0, hints: 0 });
  });
});

describe('coinsForCompletion', () => {
  it('scales the reward with the piece count', () => {
    expect(coinsForCompletion(8)).toBeGreaterThan(coinsForCompletion(3));
  });

  it('always awards something', () => {
    expect(coinsForCompletion(3)).toBeGreaterThan(0);
  });

  it('returns whole coins', () => {
    for (const size of [3, 4, 5, 6, 7, 8, 9, 10] as const) {
      expect(Number.isInteger(coinsForCompletion(size))).toBe(true);
    }
  });
});

describe('STARTER_GRANT', () => {
  it('gives a new player enough hints to learn what they do', () => {
    expect(STARTER_GRANT.deltaHints).toBeGreaterThanOrEqual(3);
  });
});

describe('dailyBonusFor', () => {
  it('pays the base amount for a first-ever claim', () => {
    expect(dailyBonusFor(0)).toBe(DAILY_BONUS.base);
  });

  it('grows with each consecutive day', () => {
    expect(dailyBonusFor(1)).toBe(DAILY_BONUS.base + DAILY_BONUS.perDay);
    expect(dailyBonusFor(2)).toBe(DAILY_BONUS.base + DAILY_BONUS.perDay * 2);
  });

  it('caps, so a long streak cannot out-earn actually playing', () => {
    expect(dailyBonusFor(50)).toBe(DAILY_BONUS.cap);
    expect(dailyBonusFor(5000)).toBe(DAILY_BONUS.cap);
  });

  it('never pays less than the base, whatever nonsense it is handed', () => {
    expect(dailyBonusFor(-3)).toBe(DAILY_BONUS.base);
    expect(dailyBonusFor(0.9)).toBe(DAILY_BONUS.base);
  });

  it('stays below a big-board completion, so playing is still the best rate', () => {
    // A 10x10 pays `coinsForCompletion(10)`. If the daily ever beat that, the
    // fastest way to earn would be to not play.
    expect(DAILY_BONUS.cap).toBeLessThan(coinsForCompletion(10));
  });
});
