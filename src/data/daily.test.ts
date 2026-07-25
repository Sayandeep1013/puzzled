import { dateKey, pickDailyPuzzle, streakFrom } from './daily';

const catalog = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

describe('dateKey', () => {
  it('formats as YYYY-MM-DD', () => {
    expect(dateKey(new Date(2026, 6, 26))).toBe('2026-07-26');
  });

  it('zero-pads single-digit months and days', () => {
    expect(dateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('uses local date parts, so late-evening play does not skip a day', () => {
    expect(dateKey(new Date(2026, 6, 26, 23, 59))).toBe('2026-07-26');
  });
});

describe('pickDailyPuzzle', () => {
  it('is stable for the same date', () => {
    expect(pickDailyPuzzle(catalog, '2026-07-26')).toEqual(pickDailyPuzzle(catalog, '2026-07-26'));
  });

  it('returns null for an empty catalog', () => {
    expect(pickDailyPuzzle([], '2026-07-26')).toBeNull();
  });

  it('varies across dates', () => {
    const picks = new Set(
      ['2026-07-26', '2026-07-27', '2026-07-28', '2026-07-29'].map(
        (key) => pickDailyPuzzle(catalog, key)?.id,
      ),
    );
    expect(picks.size).toBeGreaterThan(1);
  });
});

describe('streakFrom', () => {
  it('is zero with no history', () => {
    expect(streakFrom([], '2026-07-26')).toBe(0);
  });

  it('counts consecutive days ending today', () => {
    expect(streakFrom(['2026-07-24', '2026-07-25', '2026-07-26'], '2026-07-26')).toBe(3);
  });

  it('survives a gap only if the streak still reaches yesterday', () => {
    expect(streakFrom(['2026-07-25'], '2026-07-26')).toBe(1);
    expect(streakFrom(['2026-07-20'], '2026-07-26')).toBe(0);
  });

  it('ignores duplicate entries for one day', () => {
    expect(streakFrom(['2026-07-26', '2026-07-26'], '2026-07-26')).toBe(1);
  });
});
