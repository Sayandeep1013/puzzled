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
   * Piece depth, and it is **shadow**, not light.
   *
   * The first attempt rimmed every piece in bright white, which does read as 3D
   * but as a glow rather than as a physical tile. Studying the mockup at 8x, its
   * pieces have no light rim at all: they cast a soft shadow down and slightly
   * right, and carry a thin *darker* edge where the artwork ends.
   *
   * The mockup also treats the two piece states differently, which the first
   * attempt did not:
   *
   * - **Loose, tray and lifted pieces** are objects resting above a surface, so
   *   they get the drop shadow and the dark edge.
   * - **Locked pieces** are part of the finished picture, so they get only a
   *   hairline seam. Embossing them made the assembled image look tiled.
   *
   * Still fully procedural — the shadow follows the silhouette the engine already
   * computes, so an imported photo behaves exactly like bundled art and no
   * per-puzzle assets are needed.
   */
  depth: {
    /** Drop shadow under a raised piece. */
    shadowColor: 'rgba(46, 32, 16, 0.5)',
    shadowDy: 3,
    shadowBlur: 5,
    /** Thin darker edge at the silhouette boundary, in place of a white rim. */
    edgeColor: 'rgba(52, 38, 20, 0.34)',
    edgeWidth: 1.5,
    /** Barely-there seam between locked pieces, so the picture reads continuous. */
    seamColor: 'rgba(23, 33, 33, 0.1)',
    seamWidth: 1,
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
   * Tray geometry.
   *
   * Two rows, four columns visible. One row of larger pieces left a fourth piece
   * permanently sliced by the screen edge and wasted the space below the strip,
   * which pushed the toolbar unnaturally high.
   *
   * Columns fill top-to-bottom then rightward, so scrolling right reveals whole
   * new columns rather than shuffling the existing ones.
   */
  tray: {
    rows: 2,
    /** Columns fully visible at once — the piece size follows from this. */
    visibleColumns: 4,
    /** Gap between the piece grid and the scroll slider, so they never touch. */
    sliderGap: 12,
    /** Height of the slider's track and pill. */
    sliderHeight: 10,
  },
} as const;
