import { buildMonthGrid, DAYS_IN_WEEK, MONTHS, WEEKDAYS } from './calendar';

/**
 * These pin the shape of the grid, not the arithmetic.
 *
 * The bug this covers was not a wrong date — every number was right — it was
 * that the *rows* were six wide while the header was seven, so each date was
 * drawn under the wrong weekday. Only a test that counts columns catches that;
 * one that checks "does August have 31 days" passes either way.
 */

describe('buildMonthGrid', () => {
  it('gives every week exactly seven columns, header included', () => {
    expect(WEEKDAYS).toHaveLength(DAYS_IN_WEEK);
    for (const week of buildMonthGrid(new Date(2026, 7, 23)).weeks) {
      expect(week).toHaveLength(DAYS_IN_WEEK);
    }
  });

  it('puts each date under its own weekday', () => {
    // August 2026 is the month that exposed this: the 1st is a Saturday, the
    // last column, so a grid one column short moves it to the far left and
    // everything after it with it.
    const { weeks } = buildMonthGrid(new Date(2026, 7, 23));
    for (const week of weeks) {
      week.forEach((day, column) => {
        if (day != null) {
          expect(new Date(2026, 7, day).getDay()).toBe(column);
        }
      });
    }
  });

  it('opens with blanks up to the first of the month, and no more', () => {
    const { weeks } = buildMonthGrid(new Date(2026, 7, 23));
    // Saturday: six blanks, then the 1st in the seventh column.
    expect(weeks[0]).toEqual([null, null, null, null, null, null, 1]);
  });

  it('pads the last week rather than leaving a short row', () => {
    const { weeks } = buildMonthGrid(new Date(2026, 7, 23));
    const last = weeks[weeks.length - 1];
    expect(last).toHaveLength(DAYS_IN_WEEK);
    expect(last.filter((day) => day != null)).not.toHaveLength(0);
  });

  it('holds every day of the month exactly once', () => {
    for (const month of [0, 1, 3, 7, 11]) {
      const days = buildMonthGrid(new Date(2026, month, 15))
        .weeks.flat()
        .filter((day): day is number => day != null);
      expect(days).toEqual(Array.from({ length: days.length }, (_, i) => i + 1));
    }
  });

  it('handles a leap February, which is the one month that can fill exactly', () => {
    // 2032-02-01 is a Sunday and February has 29 days that year, so the grid is
    // five clean weeks with no leading blanks — the case an off-by-one pad breaks.
    const { weeks } = buildMonthGrid(new Date(2032, 1, 10));
    expect(weeks[0][0]).toBe(1);
    expect(weeks.flat().filter((day) => day != null)).toHaveLength(29);
    for (const week of weeks) {
      expect(week).toHaveLength(DAYS_IN_WEEK);
    }
  });

  it('labels the month the way the card heading reads it', () => {
    expect(buildMonthGrid(new Date(2026, 7, 23)).label).toBe('August 2026');
    expect(MONTHS).toHaveLength(12);
  });

  it('reports today as the day of the month, not the weekday', () => {
    expect(buildMonthGrid(new Date(2026, 7, 23)).today).toBe(23);
  });
});
