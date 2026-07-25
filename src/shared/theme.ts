import * as tokens from './tokens';

export { accentAt, accentRamp, border, radii, shadow, spacing, springs } from './tokens';

/**
 * Weight is encoded in the family name for custom fonts. Never pair these with
 * a `fontWeight` — on Android that silently picks a synthesised face.
 */
export const fonts = {
  display: 'Fredoka_600SemiBold',
  displayBold: 'Fredoka_700Bold',
  body: 'Nunito_400Regular',
  bodyBold: 'Nunito_700Bold',
  bodyBlack: 'Nunito_800ExtraBold',
} as const;

export const typography = {
  hero: { fontFamily: fonts.displayBold, fontSize: 44, letterSpacing: -1 },
  title: { fontFamily: fonts.displayBold, fontSize: 30, letterSpacing: -0.5 },
  heading: { fontFamily: fonts.display, fontSize: 22 },
  label: { fontFamily: fonts.bodyBlack, fontSize: 13, letterSpacing: 1.2 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23 },
  bodyStrong: { fontFamily: fonts.bodyBold, fontSize: 15 },
  caption: { fontFamily: fonts.bodyBold, fontSize: 13 },
} as const;

/**
 * TEMPORARY. Maps the retired paper-theme names onto Chunky Pop so screens keep
 * compiling while they are converted one at a time in Milestone D.
 *
 * Task 17 asserts that no source file references any of these. Delete this block
 * when that assertion passes — it must not survive Phase 1.
 */
export const legacyColors = {
  canvas: tokens.colors.paper,
  surfaceStrong: tokens.colors.surface,
  kraft: tokens.colors.sunshine,
  inkSoft: tokens.colors.ink,
  primary: tokens.colors.grape,
  primaryPressed: tokens.colors.grape,
  accent: tokens.colors.tangerine,
  accentPressed: tokens.colors.tangerine,
  gold: tokens.colors.sunshine,
  goldPressed: tokens.colors.sunshine,
  sage: tokens.colors.mint,
  rose: tokens.colors.bubblegum,
  line: tokens.colors.ink,
  sketch: tokens.colors.ink,
  shadow: tokens.colors.ink,
} as const;

/**
 * Screens import `colors` from here (never from `./tokens` directly) so that
 * unconverted screens using retired names (`colors.canvas`, `colors.sage`, ...)
 * keep resolving alongside the new Chunky Pop names.
 */
export const colors = { ...tokens.colors, ...legacyColors } as const;
