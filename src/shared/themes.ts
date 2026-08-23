import { backgrounds as meadowBackgrounds, colors as meadowColors } from './tokens';

/**
 * The app's themes.
 *
 * Only two token groups vary: the palette and the per-screen grounds. Radii,
 * spacing, springs, motion and typography are *structure*, not skin — a theme
 * that changed them would be a different app, not a different look, and every
 * layout in the codebase is tuned against those numbers.
 *
 * The splash deliberately sits outside this. Its background is written into
 * `app.json` and baked into the native launch window, so it cannot follow a
 * theme chosen at runtime — and it should not: the launch screen is the app's
 * identity, not the player's preference.
 */

export type ThemeId = 'meadow' | 'wood';

/**
 * The palette, keyed exactly like the meadow's but widened to `string`.
 *
 * `tokens.ts` declares its colours `as const`, which types every value as its
 * own literal — so a second theme cannot supply a different hex for `ink`
 * without this. Keying off the original keeps the two in step: add a colour
 * there and every theme is required to provide it.
 */
export type ThemePalette = { [K in keyof typeof meadowColors]: string };

/** Per-screen grounds. Same keys for every theme, so screens never branch. */
export interface ThemeBackgrounds {
  homeSky: string;
  homeGrass: string;
  game: string;
  results: string;
  pack: string;
  default: string;
}

export interface Theme {
  id: ThemeId;
  /** Shown in the theme picker. */
  name: string;
  /** One line in the picker, saying what the theme *is*. */
  description: string;
  /** Coins to unlock. Zero means it ships unlocked. */
  price: number;
  colors: ThemePalette;
  backgrounds: ThemeBackgrounds;
  /**
   * Full-bleed artwork behind Home, or null for a flat `backgrounds.default`.
   *
   * A `require`d module id — Metro only resolves literal requires, so a theme
   * cannot name its background as a string.
   */
  homeBackground: number | null;
  /**
   * A material laid over the ground on *every* screen, or null for a flat one.
   *
   * Separate from `homeBackground` because it answers a different question:
   * that one is a picture Home sits on, this one is what the app is made of. A
   * theme called Wood that renders as a flat tan rectangle everywhere except
   * Home is not really a wood theme — the grain has to be on the screens the
   * player actually spends time in.
   */
  groundTexture: number | null;
}

export const MEADOW: Theme = {
  id: 'meadow',
  name: 'Meadow',
  description: 'Sky, grass and a sunny afternoon.',
  price: 0,
  colors: meadowColors,
  backgrounds: meadowBackgrounds,
  homeBackground: require('../../assets/backgrounds/home.png'),
  // The meadow's ground is flat paper by design — the illustration lives on Home.
  groundTexture: null,
};

/**
 * Wood — the notebook-on-a-desk direction from the team's second mockup.
 *
 * Built by re-grounding rather than re-hueing: the *accents* (grass, sky,
 * honey, cherry…) are deliberately kept, because they are what the art set is
 * drawn in — the coin is gold, the bear is brown, and a theme that recoloured
 * around them would leave every illustration looking imported from elsewhere.
 * What changes is what those accents sit on.
 */
export const WOOD: Theme = {
  id: 'wood',
  name: 'Wood',
  description: 'Warm oak, paper cards and a pencil.',
  price: 500,
  /**
   * Every value here was chosen against `themes.test.ts`'s contrast table, not
   * by eye. The first attempt used a deep walnut ground (#B98552) because it
   * looked like the mockup's desk — and on device its muted body text measured
   * under 2:1 against it, which is a paragraph you cannot read. The desk is a
   * light oak now: same material, enough luminance to carry text between the
   * cards as well as on them.
   */
  colors: {
    ...meadowColors,
    /** Warmer and deeper than the meadow's ink, to hold against oak. */
    ink: '#402D18',
    inkMuted: '#5F4224',
    /** Headings take the wood's own deep amber rather than a green. */
    headingGreen: '#6E3608',
    headingBlue: '#1F5C8F',
    /** The desk. */
    paper: '#E2CBA8',
    /** Paper cards on the desk — warmer and lighter than the meadow's cream. */
    surface: '#F7E9CB',
  },
  backgrounds: {
    homeSky: '#E2CBA8',
    homeGrass: '#CBAE87',
    /** The board sits on a paler sheet than the desk. */
    game: '#EFE1C4',
    results: '#2E97D8',
    pack: '#D8BC93',
    default: '#E2CBA8',
  },
  // No separate Home picture: the grain below covers every screen including
  // Home, which is what makes the theme read as one material rather than as an
  // illustrated home screen bolted to a flat app.
  homeBackground: null,
  groundTexture: require('../../assets/backgrounds/wood-grain.png'),
};

export const THEMES: readonly Theme[] = [MEADOW, WOOD];

export const DEFAULT_THEME_ID: ThemeId = 'meadow';

/** Never throws: an id from a newer build falls back to the shipped default. */
export function themeById(id: string | null | undefined): Theme {
  return THEMES.find((theme) => theme.id === id) ?? MEADOW;
}
