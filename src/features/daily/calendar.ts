/** Column headers, Sunday-first — the order `Date.getDay()` returns. */
export const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** Days in the week, named so the chunking below reads as a calendar and not as arithmetic. */
export const DAYS_IN_WEEK = 7;

export interface MonthGrid {
  /** "August 2026". */
  label: string;
  /** One array per week, always exactly seven long; `null` is a cell with no date. */
  weeks: (number | null)[][];
  /** Day of the month `today` falls on. */
  today: number;
}

/**
 * The month `today` falls in, as week rows.
 *
 * Rows rather than one flat list left to `flexWrap`, because wrapping cells of
 * `100 / 7`% does not fit seven per row: that width is
 * `14.285714285714286`%, seven of them sum to `100.00000000000001`, and Yoga
 * wraps the last one. Every row then held six. On device that put August 1st —
 * a Saturday — in the Sunday column and slid the whole month across, ring
 * around today included, under a header that still said S M T W T F S.
 *
 * Local time throughout: the grid is the player's calendar, so `new Date(y, m,
 * d)` is correct here and a UTC-based month would be off by one for anybody east
 * or west far enough.
 */
export function buildMonthGrid(today: Date): MonthGrid {
  const year = today.getFullYear();
  const month = today.getMonth();

  const firstWeekday = new Date(year, month, 1).getDay();
  // Day 0 of the next month is the last day of this one.
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(day);
  }
  // Padded to a whole week so the last row has seven children like every other:
  // the cells are `flex: 1`, and a row holding only the 31st would stretch it
  // across the width of the card.
  while (cells.length % DAYS_IN_WEEK !== 0) {
    cells.push(null);
  }

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += DAYS_IN_WEEK) {
    weeks.push(cells.slice(i, i + DAYS_IN_WEEK));
  }

  return { label: `${MONTHS[month]} ${year}`, weeks, today: today.getDate() };
}
