/** Bump when piece-edge or path generation math changes incompatibly with saved sessions. */
export const GENERATOR_ALGORITHM_VERSION = 1;

/** Default snap radius as a fraction of the board cell size. */
export const DEFAULT_SNAP_THRESHOLD_RATIO = 0.28;

/** Tab / blank protrusion as a fraction of the shorter cell side. */
export const TAB_SIZE_RATIO = 0.22;

/** Normalized path control points for a single edge running from 0 → 1. */
export const EDGE_CONTROL = {
  neckStart: 0.35,
  neckEnd: 0.65,
  tabPeak: 0.5,
  tabDepth: 1,
} as const;
