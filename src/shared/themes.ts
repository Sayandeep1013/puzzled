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
}

export const MEADOW: Theme = {
  id: 'meadow',
  name: 'Meadow',
  description: 'Sky, grass and a sunny afternoon.',
  price: 0,
  colors: meadowColors,
  backgrounds: meadowBackgrounds,
  homeBackground: require('../../assets/backgrounds/home.png'),
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
  colors: {
    ...meadowColors,
    /** Warmer and deeper than the meadow's ink, to hold against oak. */
    ink: '#402D18',
    inkMuted: '#8A6842',
    /** Headings take the wood's own deep amber rather than a green. */
    headingGreen: '#7A3E12',
    headingBlue: '#1F5C8F',
    /** The desk. */
    paper: '#B98552',
    /** Paper cards on the desk — warmer and lighter than the meadow's cream. */
    surface: '#F7E9CB',
  },
  backgrounds: {
    homeSky: '#B98552',
    homeGrass: '#9A6B3F',
    /** The board sits on a paler sheet than the desk. */
    game: '#E4D2AE',
    results: '#2E97D8',
    pack: '#C9A46E',
    default: '#B98552',
  },
  homeBackground: require('../../assets/backgrounds/home-wood.png'),
};

export const THEMES: readonly Theme[] = [MEADOW, WOOD];

export const DEFAULT_THEME_ID: ThemeId = 'meadow';

/** Never throws: an id from a newer build falls back to the shipped default. */
export function themeById(id: string | null | undefined): Theme {
  return THEMES.find((theme) => theme.id === id) ?? MEADOW;
}
