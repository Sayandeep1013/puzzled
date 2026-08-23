import { createPlayClock, formatClock } from './play-clock';

describe('createPlayClock', () => {
  it('accrues only while running', () => {
    const clock = createPlayClock();
    expect(clock.elapsedAt(0)).toBe(0);

    clock.start(1_000);
    expect(clock.elapsedAt(4_000)).toBe(3_000);

    clock.stop(4_000);
    // The whole point: a paused clock does not keep counting.
    expect(clock.elapsedAt(60_000)).toBe(3_000);
  });

  it('resumes from where it stopped rather than restarting', () => {
    const clock = createPlayClock();
    clock.start(0);
    clock.stop(5_000);
    clock.start(100_000); // A long pause — the app was backgrounded.
    expect(clock.elapsedAt(102_000)).toBe(7_000);
  });

  it('seeds from a restored session', () => {
    // Returning to a half-finished board must show the time already spent on
    // it, not 00:00.
    const clock = createPlayClock(90_000);
    clock.start(0);
    expect(clock.elapsedAt(2_000)).toBe(92_000);
  });

  it('ignores repeated starts and stops', () => {
    const clock = createPlayClock();
    clock.start(0);
    clock.start(3_000); // Must not re-anchor and lose the first 3s.
    expect(clock.elapsedAt(4_000)).toBe(4_000);

    clock.stop(4_000);
    clock.stop(9_000); // Must not bank the paused stretch.
    expect(clock.elapsedAt(9_000)).toBe(4_000);
  });

  it('never goes backwards when the device clock jumps', () => {
    // `Date.now()` follows the system clock, so an NTP correction or the player
    // changing the date can hand back a `now` earlier than the start.
    const clock = createPlayClock(10_000);
    clock.start(50_000);
    expect(clock.elapsedAt(20_000)).toBe(10_000);

    clock.stop(20_000);
    expect(clock.elapsedAt(20_000)).toBe(10_000);
  });

  it('keeps running across a reset, and stopped across a reset', () => {
    const running = createPlayClock();
    running.start(0);
    running.reset(1_000, 0);
    expect(running.running).toBe(true);
    expect(running.elapsedAt(3_000)).toBe(2_000);

    const stopped = createPlayClock(5_000);
    stopped.reset(1_000, 0);
    expect(stopped.running).toBe(false);
    expect(stopped.elapsedAt(9_000)).toBe(0);
  });

  it('clamps a negative seed', () => {
    expect(createPlayClock(-5_000).elapsedAt(0)).toBe(0);
  });
});

describe('formatClock', () => {
  it('renders mm:ss below an hour', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(9_000)).toBe('00:09');
    expect(formatClock(61_500)).toBe('01:01');
    expect(formatClock(59 * 60 * 1000 + 59_000)).toBe('59:59');
  });

  it('adds hours past one', () => {
    expect(formatClock(3_600_000)).toBe('1:00:00');
    expect(formatClock(3_723_000)).toBe('1:02:03');
  });

  it('floors rather than rounding, so the clock never shows a second early', () => {
    expect(formatClock(1_999)).toBe('00:01');
  });

  it('treats a negative total as zero', () => {
    expect(formatClock(-1)).toBe('00:00');
  });
});
