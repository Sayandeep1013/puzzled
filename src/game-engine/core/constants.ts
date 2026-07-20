/** Bump when piece-edge or path generation math changes incompatibly with saved sessions. */
export const GENERATOR_ALGORITHM_VERSION = 1;

/** Default snap radius as a fraction of the board cell size. */
export const DEFAULT_SNAP_THRESHOLD_RATIO = 0.28;

/** Tab / blank protrusion as a fraction of the shorter cell side. */
export const TAB_SIZE_RATIO = 0.2;

/**
 * Jigsaw knob outline, as cubic segments in normalized edge space.
 *
 * `t` runs 0 → 1 along the edge; `k` is the outward offset in units of tab size.
 * Two properties matter here:
 *
 * 1. The profile is symmetric about t = 0.5. A tab and its neighbouring blank
 *    trace the same edge in opposite directions with opposite sign, so symmetry
 *    is exactly what makes the two silhouettes mate.
 * 2. The bulb (t 0.32 → 0.68) is wider than its neck (t 0.35 → 0.65). Without
 *    that the knob tapers to a spike and reads as a star, not a puzzle piece.
 */
export const KNOB_PROFILE = {
  neckStart: 0.35,
  neckEnd: 0.65,
  segments: [
    // Neck flares outward and undercuts back to the base of the bulb.
    { c1: { t: 0.4, k: 0.23 }, c2: { t: 0.28, k: 0.64 }, to: { t: 0.32, k: 1 } },
    // Round over the top of the bulb.
    { c1: { t: 0.36, k: 1.45 }, c2: { t: 0.64, k: 1.45 }, to: { t: 0.68, k: 1 } },
    // Mirror of the first segment, back down to the edge.
    { c1: { t: 0.72, k: 0.64 }, c2: { t: 0.6, k: 0.23 }, to: { t: 0.65, k: 0 } },
  ],
} as const;
