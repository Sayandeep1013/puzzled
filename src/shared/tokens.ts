/**
 * Chunky Pop primitives. No React, no React Native — importable from tests and
 * from any layer. Screens import these through `@/shared/theme`.
 */

export const colors = {
  // Ink is used for every outline, every shadow, and primary text. Slightly off
  // black so large filled areas do not vibrate against the warm paper.
  ink: '#141414',
  inkMuted: '#5C5A57',

  paper: '#FFF8EC',
  surface: '#FFFFFF',

  grape: '#7B5CFF',
  bubblegum: '#FF5CA8',
  tangerine: '#FF7A3D',
  sunshine: '#FFC93C',
  mint: '#2ED9A0',
  sky: '#3DBEFF',
  cherry: '#FF4757',

  /** Text placed on top of a saturated fill. */
  onFill: '#FFFFFF',
} as const;

/**
 * Ordered brights. Lists index into this so colour assignment is deterministic
 * across renders — a card must not change colour when the list re-sorts.
 */
export const accentRamp = [
  colors.grape,
  colors.bubblegum,
  colors.tangerine,
  colors.sunshine,
  colors.mint,
  colors.sky,
] as const;

export function accentAt(index: number): string {
  const length = accentRamp.length;
  return accentRamp[((index % length) + length) % length];
}

/** Nothing in this theme has a sharp corner. */
export const radii = { sm: 14, md: 22, lg: 32, xl: 44, pill: 999 } as const;

export const border = { thin: 2, standard: 3 } as const;

/** Hard offset shadow distances, in points. Blur is always zero. */
export const shadow = { pressed: 2, default: 4, hero: 6 } as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;

/** Every motion in the app overshoots slightly. */
export const springs = {
  pop: { damping: 14, stiffness: 180, mass: 0.8 },
  snappy: { damping: 20, stiffness: 320, mass: 0.6 },
} as const;
