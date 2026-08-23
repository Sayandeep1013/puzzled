/**
 * The play clock, as a pure accumulator.
 *
 * This app used to keep **two** clocks that disagreed, which is why pausing
 * appeared to do nothing and returning to a puzzle appeared to reset it:
 *
 * - The header's `elapsed` counted `setInterval` ticks from `0` on every mount.
 *   It never read `session.elapsedMs`, so resuming a half-finished board showed
 *   `00:00`, and it never wrote it either.
 * - The board's `baselineElapsedMs + (Date.now() - startedAtMs)` — the number
 *   actually persisted, and the one Statistics, "Best time" and the Speed Master
 *   achievement are computed from — was raw wall clock. It kept running while
 *   the game was paused, while a sheet was open, and while the app was in the
 *   background.
 *
 * So the visible clock stopped but did not persist, and the persisted clock
 * persisted but did not stop. This is the single source both now read.
 *
 * Kept free of React and of `Date.now()` — `now` is always passed in — so the
 * accounting is directly testable, including the cases that are awkward to
 * reproduce on a device: a pause spanning a background/foreground cycle, and a
 * device clock that jumps backwards mid-game.
 */
export interface PlayClock {
  /** Whether time is currently accruing. */
  readonly running: boolean;
  /** Total milliseconds played, as of `now`. */
  elapsedAt(now: number): number;
  /** Begin accruing. A no-op if already running. */
  start(now: number): void;
  /** Bank the time accrued since `start` and stop. A no-op if already stopped. */
  stop(now: number): void;
  /**
   * Re-seed the total — restoring a saved session, or restarting the board.
   * Preserves the running state, so a reset mid-play keeps counting from the
   * new total rather than silently stopping.
   */
  reset(now: number, totalMs?: number): void;
}

export function createPlayClock(initialMs = 0): PlayClock {
  let banked = Math.max(0, initialMs);
  let startedAt: number | null = null;

  /**
   * Never negative.
   *
   * `Date.now()` is not monotonic: it follows the system clock, so an automatic
   * timezone/NTP correction or the player changing the date mid-game can make
   * `now` earlier than `startedAt`. Without this floor that subtracts time from
   * the total, and a large enough jump would show a negative clock.
   */
  const sinceStart = (now: number) => (startedAt == null ? 0 : Math.max(0, now - startedAt));

  return {
    get running() {
      return startedAt != null;
    },
    elapsedAt(now) {
      return banked + sinceStart(now);
    },
    start(now) {
      if (startedAt == null) {
        startedAt = now;
      }
    },
    stop(now) {
      if (startedAt != null) {
        banked += sinceStart(now);
        startedAt = null;
      }
    },
    reset(now, totalMs = 0) {
      banked = Math.max(0, totalMs);
      startedAt = startedAt == null ? null : now;
    },
  };
}

/** `mm:ss`, or `h:mm:ss` past an hour. Shared by the board header and Results. */
export function formatClock(totalMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(totalMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mmss = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return hours > 0 ? `${hours}:${mmss}` : mmss;
}
