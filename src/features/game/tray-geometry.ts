import { type PieceLocalPath } from '@/game-engine';

/**
 * Tray slot sizing, kept free of Skia so it can be tested directly.
 *
 * `puzzle-board.tsx` imports Skia at module scope, which jest cannot load, so the
 * arithmetic that decides whether a piece fits its slot lives here instead of
 * beside the component that uses it.
 */

/**
 * Slot edge in points, derived so exactly `FX.tray.visibleColumns` fit the narrowest
 * phone width this app targets. Pieces are deliberately smaller than they once were:
 * at the old size a fourth piece was always half off-screen.
 */
export const TRAY_SLOT = 92;

/** Fraction of a slot the largest piece is allowed to fill. */
export const TRAY_SLOT_FILL = 0.86;

/**
 * The board mat's drop shadow, in points.
 *
 * `blur` is a Gaussian sigma, so the shadow stays visible for roughly two sigma
 * past its offset — `BOARD_SHADOW_REACH` below.
 */
export const BOARD_SHADOW = { dy: 5, blur: 10 } as const;

/** How far below the mat its shadow is still visible. */
export const BOARD_SHADOW_REACH = BOARD_SHADOW.dy + BOARD_SHADOW.blur * 2;

/**
 * Gap between the fitted board and the tray shelf.
 *
 * Must be at least `BOARD_SHADOW_REACH`, because the board zone is clipped at the
 * tray line to stop panned board content bleeding onto the shelf. At the old 14 the
 * mat's shadow was still strong where that clip fell, so it was sliced flat in a
 * straight line just above the tray — a hard horizontal edge under a soft shadow,
 * which read as the board being cut off. Widening the gap lets the shadow fade out
 * completely on its own before the clip is reached, so nothing needs to be cut.
 */
export const TRAY_GAP = 28;

/**
 * The largest extent any of these pieces actually occupies, in board units.
 *
 * Measured from the generated paths instead of predicted from `cellSize`, which is
 * what made pieces overflow their tray slots. The obvious prediction —
 * `cellSize * (1 + 2 * TAB_SIZE_RATIO)`, a cell plus a tab each side — understates
 * the real bounds by 12.9%, because bounds come from the curves' *control points*
 * and a tab's control hull reaches about 1.45x the nominal tab depth. At `cellSize`
 * 72 a two-tab piece measures 113.76 units against the predicted 100.8. With only a
 * 14% slot margin that 12.9% left 3%, so the biggest pieces filled 97% of their slot
 * and crowded into the gap between them.
 */
export function maxPieceExtent(paths: Iterable<PieceLocalPath>): number {
  let extent = 0;
  for (const { bounds } of paths) {
    extent = Math.max(extent, bounds.width, bounds.height);
  }
  return extent;
}

/**
 * Scale that fits the largest piece inside a tray slot.
 *
 * One scale for every piece in the puzzle, not one per piece: pieces must stay the
 * same size relative to each other, so they are all scaled by the biggest.
 */
export function trayThumbScale(slotInner: number, pieceExtent: number): number {
  if (pieceExtent <= 0) {
    return 1;
  }
  return (slotInner * TRAY_SLOT_FILL) / pieceExtent;
}

/**
 * Hold a tray scroll offset inside the range the current content allows.
 *
 * Offsets run `0` (leftmost) to `-overflow` (rightmost). Placing pieces shrinks the
 * content and therefore the overflow, so an offset that was valid a moment ago can
 * end up past the new limit — which parked the remaining pieces off the shelf, and
 * once the overflow hit 0 the slider unmounted and left no way to scroll back.
 */
export function clampTrayScroll(offset: number, overflow: number): number {
  const clamped = Math.min(0, Math.max(-Math.max(0, overflow), offset));
  // `Math.max(-0, x)` yields -0 when the overflow is zero. It behaves as 0 in a
  // transform, but returning it leaks negative zero into callers' comparisons.
  return clamped === 0 ? 0 : clamped;
}
