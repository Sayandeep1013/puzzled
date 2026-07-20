import type { GridSize } from '@/game-engine';

import { parseSessionStorageKey, sessionStorageKey } from './repositories';

describe('session storage keys', () => {
  it('round-trips puzzle id and size', () => {
    const sizes: GridSize[] = [3, 4, 5, 6, 7, 8, 9, 10];
    for (const size of sizes) {
      const key = sessionStorageKey('first-light', size);
      expect(parseSessionStorageKey(key)).toEqual({ puzzleId: 'first-light', gridSize: size });
    }
  });

  it('keeps a puzzle id that itself contains separators intact', () => {
    // lastIndexOf keeps the size on the right even if the id is unusual.
    const key = sessionStorageKey('weird::id', 8);
    expect(parseSessionStorageKey(key)).toEqual({ puzzleId: 'weird::id', gridSize: 8 });
  });

  it('rejects legacy bare-id keys with no size', () => {
    expect(parseSessionStorageKey('first-light')).toBeNull();
  });

  it('rejects keys whose size is not an integer', () => {
    expect(parseSessionStorageKey('first-light::abc')).toBeNull();
  });

  it('separates sizes of the same puzzle', () => {
    expect(sessionStorageKey('first-light', 4)).not.toBe(sessionStorageKey('first-light', 8));
  });
});
