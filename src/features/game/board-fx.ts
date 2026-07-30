import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Tactile + timing helpers for the puzzle board, kept in one place so the render
 * code stays focused on drawing. Haptics are best-effort and never throw — a
 * device without a taptic engine (or web) simply gets no feedback.
 */

const HAPTICS_ENABLED = Platform.OS === 'ios' || Platform.OS === 'android';

/**
 * Whether haptics may fire at all, mirroring the player's Haptics setting.
 * Defaults to on until the board reads the real value from
 * `getSettingsRepository()` at mount; the pause-menu toggle (Task 14) flips
 * this live via `setHapticsEnabled`.
 */
let hapticsEnabled = true;

/** Gate `impact()`/`success()` on the player's Haptics setting. */
export function setHapticsEnabled(on: boolean): void {
  hapticsEnabled = on;
}

/** A short impact — `light` when a piece is picked up, `medium` when it snaps home. */
export function impact(kind: 'light' | 'medium'): void {
  if (!HAPTICS_ENABLED || !hapticsEnabled) {
    return;
  }
  const style =
    kind === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light;
  // Fire-and-forget; a rejected promise (unsupported device) must not surface.
  void Haptics.impactAsync(style).catch(() => {});
}

/** The success buzz played once when the final piece locks. */
export function success(): void {
  if (!HAPTICS_ENABLED || !hapticsEnabled) {
    return;
  }
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/** Shared animation tuning so the board and its effects stay in sync. */
export const FX = {
  /** Rendered scale while a piece is lifted under the finger. */
  liftScale: 1.08,
  /** Peak scale of the snap "pop" before settling to 1. */
  popScale: 1.12,
  /** Spring settle time for a snapped piece, ms (visual only). */
  snapMs: 180,
  /** Beat before handing off to the results screen so the celebration is seen, ms. */
  celebrateMs: 1200,
  /** Confetti particle count cap. */
  confettiCount: 80,
  /** Max tilt in degrees while dragging, derived from pointer velocity. */
  maxTiltDeg: 4,
  /** Spring used when a piece settles after release. */
  settle: { damping: 14, stiffness: 180 },
  /** Neighbour wobble duration on lock, ms. */
  jiggleMs: 90,
  /**
   * Neighbour wobble peak offset, px. Cut from 2 to 1 and then to 0.6 across two
   * rounds of device testing — at anything above this every placement visibly
   * shoved its neighbours, which read as the board being knocked rather than as a
   * soft acknowledgement.
   */
  jiggleAmplitude: 0.6,

  /**
   * The one-shot ring drawn where a piece locks home.
   *
   * Was a 3px orange ring at 0.85 opacity over 420ms, which blinked and drew the
   * eye away from the board. Now a thin, low-alpha green that fades out slowly
   * enough to register as confirmation rather than a flash.
   */
  lockRing: {
    color: 'rgba(123, 193, 22, 0.55)',
    strokeWidth: 1.5,
    peakOpacity: 0.28,
    durationMs: 600,
    startRadius: 12,
    growBy: 34,
  },

  /**
   * Per-piece emboss. Depth is derived from each piece's silhouette rather than
   * baked into artwork, so bundled puzzles and imported photos light identically
   * and no per-puzzle assets are ever needed.
   *
   * Strengthened after device testing: at 0.38/0.32 alpha over a 2px offset the
   * effect was technically present but too faint to read as depth. Wider rims,
   * higher contrast, and a tighter blur make the chamfer legible.
   */
  bevel: {
    light: 'rgba(255, 255, 255, 0.85)',
    shade: 'rgba(40, 28, 14, 0.6)',
    offset: 4,
    blur: 2.5,
  },

  /**
   * Corner rounding applied to every piece silhouette, in board units.
   *
   * Border pieces have straight outer edges meeting at hard 90° corners, so an
   * unplaced corner piece looked sharp against a UI where nothing else is. Once
   * locked it *appeared* rounded only because the board's rounded clip cut it,
   * which is why the sharpness seemed to disappear on placement.
   */
  pieceCornerRadius: 6,

  /**
   * Outline on a piece resting unlocked on the board.
   *
   * Was `colors.apricot` at 2px — a hard orange ring that, with free placement,
   * appeared on most drops. It still has to say "this one is not locked yet", so
   * it stays, but as a faint green hairline rather than a warning colour.
   */
  looseOutline: {
    color: 'rgba(101, 158, 18, 0.45)',
    strokeWidth: 1.25,
  },
} as const;
