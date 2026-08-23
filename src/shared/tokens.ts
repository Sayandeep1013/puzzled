/**
 * Puzzle Journey primitives. No React, no React Native — importable from tests
 * and from any layer. Screens import these through `@/shared/theme`.
 *
 * Every colour here was sampled from the team's inspiration mockup
 * (`assets/art-source/` ships the matching icon set), not invented. Where a
 * value looks oddly specific, that is why.
 *
 * This replaces the Chunky Pop system wholesale. That direction was built on a
 * 3px ink outline plus a hard zero-blur offset shadow; this one has no outlines
 * and soft blurred shadows, so the two cannot be blended — retuning tokens
 * alone would have produced neither.
 */

export const colors = {
  /**
   * Text, sampled from the mockup's numerals. A warm dark brown rather than
   * black: against cream cards, true black reads as a hole.
   */
  ink: '#3A2B1A',
  inkMuted: '#815236',

  /** Headings sit in a deep tint of their screen rather than in `ink`. */
  headingGreen: '#195C04',
  headingBlue: '#00498F',

  /** App background — the pale sage every non-hero screen sits on. */
  paper: '#DFECCC',
  /**
   * Card fill. Cards are warm cream in this direction, not white; white cards
   * on a green ground read as cut-outs.
   */
  surface: '#FDF5D6',
  /** True white, for photo and board bodies where cream would tint the art. */
  white: '#FFFFFF',

  /** Primary CTA. Every Play / Start / Continue button. */
  grass: '#7BC116',
  /** Secondary green, for selected states that must not read as the CTA. */
  leaf: '#80C755',

  sky: '#50ADE9',

  /**
   * Deeper variants for button faces that carry white labels.
   *
   * The mockup puts white text on its bright green Play button, which measures
   * 2.21:1 — below WCAG AA even for large text. Rather than give up the
   * white-on-green look, buttons take a channel-scaled darker shade of the same
   * hue (x0.82 grass, x0.87 sky), which lands at 3.25:1 and 3.21:1. The mockup
   * shades its own buttons the same way, so this reads as intended, not muddy.
   *
   * Only the two tones actually used as button fills need this; every other
   * tone reaches AA with ink text on the bright value.
   */
  grassDeep: '#659E12',
  skyDeep: '#4697CB',
  berry: '#9E6EE6',
  blossom: '#F98BB8',
  /** Coins, stars, progress. */
  honey: '#FCDD31',
  apricot: '#FD9C02',
  /** Destructive, and the streak flame. */
  cherry: '#EF4C3A',

  /** Locked rows and disabled art. Deliberately desaturated. */
  locked: '#C7C7C6',

  /** Text placed on top of a saturated fill. */
  onFill: '#FFFFFF',
} as const;

/**
 * Per-screen background tint. The mockup gives each screen its own ground
 * rather than one app-wide colour, and a few are saturated enough that text on
 * them must be white — hence `onTint`.
 */
export const backgrounds = {
  /** Home: sky above, grass band below. */
  homeSky: '#8AE3F5',
  homeGrass: '#A8D95C',
  /** Game board screen — pale yellow-green. */
  game: '#DFEF9F',
  /**
   * Results — the one saturated, celebratory ground.
   *
   * Deepened from `#2E97D8`. That blue carried the honey title at 2.38:1 and
   * white at 3.21:1 — the title missing even the 3.0 bar large text gets, on the
   * one screen whose whole job is to be read at a glance. Same cerulean, dark
   * enough to hold both: honey 3.37:1, white 4.56:1.
   */
  results: '#1F7CB4',
  /** Pack and collection listings. */
  pack: '#83D799',
  /** Everything else. */
  default: colors.paper,
} as const;

/**
 * The launch screen — the one moment two separate renderers have to agree.
 *
 * Android draws a splash *window* from the moment the icon is tapped until React
 * Native has a frame (measured on this app: `am start -W` reports ~1076ms), and
 * that window cannot be removed, only dressed. So there will always be two
 * things on screen in sequence, and the only question is whether the seam shows.
 *
 * It did. The native splash drew the bear at `imageWidth` while `LoadingScreen`
 * drew it at `min(width * 0.52, 240)` — equal only on a 360dp-wide phone, which
 * is the width the test happened to check. On the 393–412dp phones most people
 * actually hold, the bear jumped 16–22% larger at the handoff, and a wordmark,
 * three dots and a caption appeared around it at the same instant. Two screens.
 *
 * These numbers are the contract that stops that: `LoadingScreen` opens with its
 * bear at exactly `iconWidth` on exactly `background`, so its first frame is
 * indistinguishable from the native window's last one, and *then* animates. The
 * native splash becomes the first frame of the loading screen rather than a
 * different screen shown before it. `src/shared/splash.test.ts` pins both values
 * against `app.json`, which cannot import from here.
 */
export const splash = {
  /** Must equal `imageWidth` in app.json's `expo-splash-screen` config. */
  iconWidth: 176,
  /** Must equal `backgroundColor` in the same config. */
  background: backgrounds.homeSky,
} as const;

/**
 * Ordered brights. Lists index into this so colour assignment is deterministic
 * across renders — a card must not change colour when the list re-sorts.
 */
export const accentRamp = [
  colors.grass,
  colors.sky,
  colors.berry,
  colors.blossom,
  colors.apricot,
  colors.honey,
] as const;

export function accentAt(index: number): string {
  const length = accentRamp.length;
  return accentRamp[((index % length) + length) % length];
}

/** Nothing in this theme has a sharp corner. */
export const radii = { sm: 14, md: 22, lg: 28, xl: 36, pill: 999 } as const;

/**
 * Soft drop shadows, expressed for RN's `boxShadow` (supported on both
 * platforms in RN 0.86 / SDK 57). Chunky Pop's hard sibling-view shadow is
 * gone: this direction blurs.
 *
 * The colour is a translucent warm brown rather than black so the shadow tints
 * with the cream surfaces instead of greying them.
 */
export const shadow = {
  card: '0px 3px 0px 0px rgba(198, 172, 116, 0.55), 0px 5px 10px 0px rgba(90, 62, 24, 0.16)',
  raised: '0px 4px 0px 0px rgba(198, 172, 116, 0.6), 0px 8px 16px 0px rgba(90, 62, 24, 0.2)',
  pressed: '0px 1px 0px 0px rgba(198, 172, 116, 0.5), 0px 2px 5px 0px rgba(90, 62, 24, 0.14)',
  /** Buttons carry a saturated fill, so their shadow can be stronger. */
  button: '0px 4px 0px 0px rgba(74, 106, 12, 0.35), 0px 7px 14px 0px rgba(40, 60, 8, 0.22)',
} as const;

/**
 * Kept for the few places that still want a hairline — chips over photos, and
 * the board's piece outlines. There is no global outline in this theme.
 */
export const border = { thin: 1, standard: 2 } as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;

/** Every motion in the app overshoots slightly. */
export const springs = {
  pop: { damping: 14, stiffness: 180, mass: 0.8 },
  snappy: { damping: 20, stiffness: 320, mass: 0.6 },
} as const;

/**
 * Durations, in ms, for the motion that is not a spring.
 *
 * Springs cover anything responding to a touch; these cover the timed motion —
 * entrances, idle loops and the loading handoff — where a duration reads more
 * predictably than a physical settle.
 */
export const motion = {
  /** A list item's fade-and-rise entrance. */
  enter: 320,
  /** Gap between consecutive items in a staggered list, so the eye tracks order. */
  stagger: 55,
  /** Half-cycle of an idle loop: a breathing bob or a slow sway. */
  idle: 1500,
  /** The loading overlay's dissolve into the app behind it. */
  handoff: 420,
  /**
   * How long the loading screen stays up at minimum.
   *
   * Fonts often resolve in well under 100ms from cache, and without a floor the
   * loading screen appears for two frames — which reads as a glitch rather than
   * as a greeting. Long enough for one bob of the bear.
   */
  loaderMinimum: 1100,
} as const;
