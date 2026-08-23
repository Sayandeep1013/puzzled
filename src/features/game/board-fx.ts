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

/**
 * Shortest gap between two haptics, in ms.
 *
 * Android coalesces vibrations that arrive on top of each other: the second one
 * is dropped, or both merge into a single longer buzz that feels like neither.
 * Placing a piece fires a snap while a pickup may still be playing, which is
 * exactly the overlap that made the feedback feel intermittent. Anything closer
 * than this is skipped rather than queued — a haptic that arrives late is worse
 * than one that does not arrive.
 */
const MIN_HAPTIC_GAP_MS = 45;

let lastHapticAt = 0;

function canFire(now: number): boolean {
  if (!HAPTICS_ENABLED || !hapticsEnabled) {
    return false;
  }
  if (now - lastHapticAt < MIN_HAPTIC_GAP_MS) {
    return false;
  }
  lastHapticAt = now;
  return true;
}

/**
 * Picking a piece up.
 *
 * `selectionAsync`, not a light impact. Android maps
 * `ImpactFeedbackStyle.Light` to a very short, very weak buzz that a good many
 * devices barely render at all — which reads as the haptic being unreliable
 * rather than gentle. Selection feedback is the platform's own "you have picked
 * this up" tick: crisper, and consistently produced.
 */
export function pickup(): void {
  if (!canFire(Date.now())) {
    return;
  }
  // Fire-and-forget; a rejected promise (unsupported device) must not surface.
  void Haptics.selectionAsync().catch(() => {});
}

/** A short impact — `light` for a nudge, `medium` when a piece snaps home. */
export function impact(kind: 'light' | 'medium'): void {
  if (!canFire(Date.now())) {
    return;
  }
  const style =
    kind === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light;
  void Haptics.impactAsync(style).catch(() => {});
}

/** The success buzz played once when the final piece locks. */
export function success(): void {
  // Deliberately not rate-limited: the completion buzz is the one haptic that
  // must never be skipped, and nothing else fires at the same moment.
  if (!HAPTICS_ENABLED || !hapticsEnabled) {
    return;
  }
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/** Shared animation tuning so the board and its effects stay in sync. */
export const FX = {
  /** Rendered scale while a piece is lifted under the finger. */
  liftScale: 1.08,
  /**
   * How long the released piece takes to travel onto its resting place, ms.
   *
   * Eased, not sprung — see `settleFloatingPiece`. A spring here overshot and rang,
   * which read as the piece jiggling after it had already been placed.
   */
  snapMs: 130,
  /** Beat before handing off to the results screen so the celebration is seen, ms. */
  celebrateMs: 1200,
  /** Confetti particle count cap. */
  confettiCount: 80,
  /** Max tilt in degrees while dragging, derived from pointer velocity. */
  maxTiltDeg: 4,

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
    shadowColor: 'rgba(46, 32, 16, 0.55)',
    shadowDy: 4,
    shadowBlur: 7,
    /** Inward rim on a raised piece, in place of a white rim. */
    edgeColor: 'rgba(52, 38, 20, 0.45)',
    edgeWidth: 2.2,
    /** Softens the rim into a gradient, so it reads as shading not as an outline. */
    edgeBlur: 2,
    /**
     * Inward rim on a locked piece — the only depth the assembled picture carries,
     * since a locked piece is flush with its neighbours and casts nothing outward.
     *
     * Was `rgba(23,33,33,0.1)` at 1px: a 10%-alpha hairline, which is why "the
     * shadow depth isn't visible" while the board filled up. Every piece the player
     * places is locked, so the board they spend the whole game looking at had
     * effectively no depth at all, however strong the raised shadow was.
     */
    seamColor: 'rgba(30, 22, 12, 0.38)',
    seamWidth: 2,
    seamBlur: 2.6,

    /**
     * The seam between two *joined* locked pieces.
     *
     * Depth is drawn on a cluster's outline now, not on every piece in it, so an
     * internal joint has no bevel of its own — which is correct, since two joined
     * pieces share one seam rather than presenting two cut edges. Left at that the
     * assembled area would stop reading as pieces at all, so each member's outline
     * is stroked this faintly and clipped to the cluster.
     *
     * In board units, which is what makes one value work at every grid size:
     * `cellSizeForGrid` anchors the board at ~290 units wide whatever the grid, so
     * a fixed width here is a fixed width on screen, and it thickens under the
     * camera's zoom exactly as a real seam would.
     *
     * Two neighbours each stroke their shared edge, so an internal joint composites
     * to roughly double this alpha while the cluster's outer boundary — stroked
     * once, and half of that clipped away — stays under the baked cut line.
     */
    jointColor: 'rgba(58, 43, 26, 0.20)',
    jointWidth: 0.4,

    /**
     * The shadow a locked cluster casts on the board.
     *
     * Locked pieces used to cast nothing, so the board went flat exactly where the
     * player had made progress. Tighter and weaker than a raised piece's: the
     * assembly is lying on the board, not held above it.
     */
    clusterShadowColor: 'rgba(46, 32, 16, 0.34)',
    clusterShadowDy: 2,
    clusterShadowBlur: 5,
  },

  /**
   * Corner radius of the board's play area, in board units.
   *
   * This is the *only* corner radius on the board, and that is the point. A corner
   * piece's outward corner is rounded with this exact value, so the piece's curve
   * and the frame's curve are the same curve and the frame's clip removes nothing.
   *
   * They used to differ: the frame clipped at 20 while pieces rounded at 6. Both
   * are board units — `cellSizeForGrid` anchors the board at 4 × 72 = 288 units
   * wide whatever the grid — so a corner piece's 2.1%-of-board curve sat inside
   * the frame's 6.9% curve and the frame sliced across it. That is why the corner
   * piece read as clipping out of the board rather than filling it.
   *
   * Keep this equal to the radius the play area is clipped with; `board-fx.test.ts`
   * pins that, and `puzzle-board.tsx` reads this for both.
   */
  boardCornerRadius: 20,

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
    /**
     * Gap between the piece grid and the scroll slider, so they never touch.
     * Widened from 12 — at that distance the slider read as part of the bottom row
     * of pieces rather than as its own control.
     */
    sliderGap: 22,
    /** Height of the slider's track and pill. */
    sliderHeight: 10,
  },
} as const;
