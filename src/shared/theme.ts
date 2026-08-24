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
 *
 * **Every name here must also be embedded by the `expo-font` config plugin in
 * `app.json`**, and the `.ttf` filename must equal the name exactly. Android
 * derives the family name from the filename, and `fonts.test.ts` fails the build
 * if the two lists drift.
 *
 * That is not a tidiness rule; it is the fix for a bug that cost six attempts.
 * Labels lost their ends on other people's phones — "Home" drawn as "Ho...",
 * "My Album" as "My Alb..." inside a card 356px wide, with hundreds of points of
 * empty space beside them. Loading these families at runtime with `useFonts`
 * alone is what caused it:
 *
 * 1. The tree mounts before the fonts finish loading (deliberately — see
 *    `src/app/_layout.tsx`). Android asks `ReactFontManager` for
 *    "Nunito_700Bold", finds no `assets/fonts/Nunito_700Bold.ttf` because
 *    nothing embedded one, and falls back to `Typeface.create(name, style)` —
 *    the *system* face, Roboto. It caches that under the custom family's name.
 * 2. Every label is therefore measured with Roboto's metrics, which are narrower
 *    than Nunito Bold's and Fredoka's by 1-9% on the strings this app uses.
 * 3. `useFonts` resolves, the real face is registered, and the labels are
 *    repainted in it — but their boxes were sized by step 2 and React never
 *    re-measures a `Text` whose props did not change. The wider glyphs no longer
 *    fit the narrower box, so `numberOfLines={1}` ellipsises.
 *
 * The overflow is a percentage of the font size, so it grows with the reader's
 * OS font scale and stays invisible on a device set below 1.0 — which is exactly
 * why it kept reaching other people first. It only bites where a label's box is
 * its own measured width (a centred or `flexShrink` label); a heading that spans
 * its container has room to spare and never showed it.
 *
 * Embedding fixes the cause rather than the symptom: the file is in the APK, so
 * step 1 resolves the real face synchronously on the very first measure, before
 * any JavaScript runs. `useFonts` stays as a fallback for a runtime without the
 * prebuilt assets, and costs nothing once they are there — `getLoadedFonts()`
 * reports an embedded family as already loaded, so the hook returns true on its
 * first render instead of waiting.
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
