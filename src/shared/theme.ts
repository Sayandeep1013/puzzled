import * as tokens from './tokens';

export {
  accentAt,
  accentRamp,
  backgrounds,
  border,
  motion,
  radii,
  shadow,
  spacing,
  splash,
  springs,
} from './tokens';

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
  hero: { fontFamily: fonts.displayBold, fontSize: 40, letterSpacing: -0.5 },
  title: { fontFamily: fonts.displayBold, fontSize: 28, letterSpacing: -0.3 },
  heading: { fontFamily: fonts.display, fontSize: 21 },
  label: { fontFamily: fonts.bodyBlack, fontSize: 13, letterSpacing: 0.6 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23 },
  bodyStrong: { fontFamily: fonts.bodyBold, fontSize: 15 },
  caption: { fontFamily: fonts.bodyBold, fontSize: 13 },
} as const;

/**
 * Screens import `colors` from here (never from `./tokens` directly) for a
 * single, stable entry point onto the Puzzle Journey palette.
 */
export const colors = tokens.colors;
