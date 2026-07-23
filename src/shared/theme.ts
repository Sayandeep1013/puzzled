export const colors = {
  // Paper / surfaces
  canvas: '#F6F2EA',
  surface: '#FFFCF6',
  surfaceStrong: '#FFFFFF',
  // Warm kraft used behind hero art / previews.
  kraft: '#EFE6D2',

  // Ink
  ink: '#2B2622',
  inkSoft: '#172121',
  inkMuted: '#6B6357',

  // Primary CTA in the mockup is a dusty purple.
  primary: '#8E7BA6',
  primaryPressed: '#75648C',

  // Warm terracotta accent (retained from the original theme).
  accent: '#E86E45',
  accentPressed: '#C95633',

  // Sketch highlight / secondary buttons.
  gold: '#E7B95A',
  goldPressed: '#CFA23F',

  sage: '#B9CDBD',
  rose: '#D89B93',

  line: '#DED8CD',
  // Slightly darker ink line for hand-drawn strokes.
  sketch: '#4A4239',
  shadow: '#172121',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radii = {
  sm: 10,
  md: 18,
  lg: 28,
  pill: 999,
} as const;

/**
 * Font family names as registered by `useFonts` in the root layout.
 * `display` is the handwritten marker face for titles; `body` is the rounded
 * companion for readable copy and numbers.
 */
export const fonts = {
  display: 'PatrickHand',
  body: 'Nunito',
  bodyBold: 'Nunito-Bold',
  bodyExtraBold: 'Nunito-ExtraBold',
} as const;

/**
 * Type ramp. Sizes and spacing are tuned for the handwritten display face,
 * which reads a touch larger than a system font at the same point size.
 */
export const typography = {
  hero: { fontFamily: fonts.display, fontSize: 46, letterSpacing: 0.5 },
  title: { fontFamily: fonts.display, fontSize: 30, letterSpacing: 0.5 },
  heading: { fontFamily: fonts.display, fontSize: 22, letterSpacing: 0.3 },
  label: { fontFamily: fonts.bodyExtraBold, fontSize: 13, letterSpacing: 1.2 },
  body: { fontFamily: fonts.body, fontSize: 16, letterSpacing: 0.2 },
  bodyStrong: { fontFamily: fonts.bodyBold, fontSize: 16, letterSpacing: 0.2 },
  caption: { fontFamily: fonts.body, fontSize: 13, letterSpacing: 0.2 },
} as const;
