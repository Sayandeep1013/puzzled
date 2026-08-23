import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { createPlayClock } from './play-clock';

/**
 * How often the clock is sampled, in ms.
 *
 * Faster than the one-second face it drives, deliberately. A one-second interval
 * only lands on a whole second by luck: pause at 4.9s and resume, and every tick
 * afterwards is 0.9s out of phase, so the displayed second changes late by up to
 * a full second. Sampling four times a second and publishing only when the whole
 * second actually changes keeps the face honest at no extra cost — this drives a
 * re-render of the game screen, and the board under it, so a render per second
 * is the budget.
 */
const SAMPLE_MS = 250;

/**
 * The clock, wrapped as an external store.
 *
 * A running clock genuinely *is* one — a mutable value changing on its own
 * schedule, outside React — and modelling it as one is what keeps the start and
 * stop transitions out of `setState`. Publishing from an effect body would be a
 * cascading render (`react-hooks/set-state-in-effect`); notifying subscribers
 * is the sanctioned equivalent, and it also lets the sampler decide for itself
 * when a change is worth a render.
 */
function createClockStore(): {
  clock: ReturnType<typeof createPlayClock>;
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => number;
  /** Publish only if the *displayed* second has moved — one render per second. */
  sample: () => void;
  /** Publish the exact current value, whatever it is. */
  publish: () => void;
} {
  const clock = createPlayClock();
  const listeners = new Set<() => void>();
  // Cached, because `getSnapshot` must return a stable value between
  // notifications or React re-renders forever.
  let snapshot = 0;

  const set = (next: number) => {
    if (next === snapshot) {
      return;
    }
    snapshot = next;
    for (const listener of listeners) {
      listener();
    }
  };

  return {
    clock,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => snapshot,
    sample() {
      const next = clock.elapsedAt(Date.now());
      if (Math.floor(next / 1000) !== Math.floor(snapshot / 1000)) {
        set(next);
      }
    },
    publish() {
      set(clock.elapsedAt(Date.now()));
    },
  };
}

export interface PlayClockHandle {
  /**
   * Whether time is actually accruing — the caller's `running` *and* the app
   * being foregrounded.
   *
   * Exposed because the caller cannot derive it: foregroundedness is tracked in
   * here. A caller that persists "when the clock stops" has to watch this, not
   * its own `running`, or backgrounding the app stops the clock without ever
   * banking the time — which is exactly how the first version of this lost
   * every minute between the last piece placed and the app being swiped away.
   */
  active: boolean;
  /** Whole milliseconds played. Changes about once per displayed second. */
  elapsedMs: number;
  /**
   * The live value, for a caller that must not wait for the next render — the
   * board writes this into `session.elapsedMs` at the instant a piece is placed.
   */
  getElapsedMs: () => number;
  /** Re-seed the total: a restored session's time, or 0 for a restarted board. */
  reset: (totalMs: number) => void;
}

/**
 * Runs the play clock and exposes it to React.
 *
 * `running` is the caller's decision — the board is live, unfinished, focused and
 * not paused. Being **foregrounded** is not: an app in the background is not
 * being played by anyone, on any screen, so it is folded in here rather than left
 * for each caller to remember. That was half of the original bug — the persisted
 * clock counted every minute the phone spent in a pocket.
 */
export function usePlayClock(running: boolean): PlayClockHandle {
  // Lazy initialiser rather than a ref written during render: the store must
  // survive re-renders but must never be constructed as a render side effect.
  const [store] = useState(createClockStore);
  const [foreground, setForeground] = useState(() => AppState.currentState !== 'background');

  const elapsedMs = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      // 'inactive' is iOS's transient state (control centre, app switcher) and
      // counts as foreground: a clock that stopped when the notification shade
      // is pulled down would read as stuttering, not as pausing.
      setForeground(state !== 'background');
    });
    return () => subscription.remove();
  }, []);

  const active = running && foreground;

  useEffect(() => {
    const { clock, publish, sample } = store;

    if (!active) {
      clock.stop(Date.now());
      // Bank the partial second before stopping, or the face keeps whatever the
      // last sample said and the pause appears to lose up to a second.
      publish();
      return;
    }

    clock.start(Date.now());
    publish();

    const id = setInterval(sample, SAMPLE_MS);
    return () => clearInterval(id);
  }, [active, store]);

  const getElapsedMs = useCallback(() => store.clock.elapsedAt(Date.now()), [store]);

  const reset = useCallback(
    (totalMs: number) => {
      store.clock.reset(Date.now(), totalMs);
      store.publish();
    },
    [store],
  );

  // `getElapsedMs` and `reset` are stable for the life of the component (the
  // store never changes identity), which matters downstream: the board's gesture
  // memo takes `getElapsedMs` and is expensive to rebuild — see
  // `puzzle-board.tsx`'s note about Skia objects in `runOnJS` closures.
  return { active, elapsedMs, getElapsedMs, reset };
}
