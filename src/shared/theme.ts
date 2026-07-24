export const colors = {
  // Paper / surfaces
  canvas: '#F6F2EA',
  surface: '#FFFCF6',
  surfaceStrong: '#FFFFFF',
  // Warm kraft used behind hero art / image previews.
  kraft: '#EFE6D2',

  // Ink
  ink: '#172121',
  inkSoft: '#172121',
  inkMuted: '#667170',

  // Primary CTA — a calm deep sage, in the family of the warm palette.
  primary: '#4C7A6B',
  primaryPressed: '#3D6357',

  // Warm terracotta accent (eyebrows, "NEW" tags, small highlights).
  accent: '#E86E45',
  accentPressed: '#C95633',

  // Secondary highlight — mustard gold (rewards, coins, progress fills).
  gold: '#E7B95A',
  goldPressed: '#CFA23F',

  sage: '#B9CDBD',
  rose: '#D89B93',

  // Hairline card border and a slightly darker line for definition.
  line: '#DED8CD',
  sketch: '#D4CBBB',
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
 * Type ramp for the clean theme. Uses the platform system font with weight and
 * spacing tokens — no custom font files, matching the flat look on `main`.
 * Screens spread these and may override individual properties (e.g. `fontSize`).
 */
export const typography = {
  hero: { fontSize: 42, fontWeight: '800', letterSpacing: -1 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  heading: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  label: { fontSize: 12, fontWeight: '800', letterSpacing: 1.4 },
  body: { fontSize: 16, fontWeight: '400', lineHeight: 23 },
  bodyStrong: { fontSize: 15, fontWeight: '700' },
  caption: { fontSize: 13, fontWeight: '600' },
} as const;
