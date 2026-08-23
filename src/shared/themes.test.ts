/// <reference types="node" />
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { colors as meadowColors } from './tokens';
import {
  DEFAULT_THEME_ID,
  MEADOW,
  THEMES,
  themeById,
  type ThemeBackgrounds,
  type ThemePalette,
} from './themes';

/**
 * Guards the theme refactor.
 *
 * The app had exactly one theme however many palettes were declared, because
 * `colors` was imported straight from `tokens.ts` and a module-level
 * `StyleSheet.create` captured those hexes when the file was first evaluated.
 * That binding is invisible — the code reads perfectly, the second theme simply
 * never appears — so it is pinned here rather than left to review.
 */

const SRC = path.join(__dirname, '..');

/** Files exempt from the import ban: they *are* the palette layer. */
const PALETTE_LAYER = ['shared/tokens.ts', 'shared/themes.ts', 'shared/theme.ts'];

/**
 * Files allowed to name a colour outright, and why.
 *
 * A hex in a screen is a colour no theme can reach. These two are not screen
 * colours: they describe what a puzzle piece is physically made of — pressed
 * chipboard, whose cut edge is the same pulp colour on an oak desk as on a
 * meadow — so they are material constants, like the piece bevel above them.
 */
const MATERIAL = ['features/game/piece-depth.tsx'];

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      sourceFiles(full, found);
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      found.push(full);
    }
  }
  return found;
}

/** `colors` or `backgrounds` pulled in as a bare specifier from the theme barrel. */
function importsStaticPalette(source: string): boolean {
  const statement = source.match(/import \{([^}]*)\} from '@\/shared\/theme';/);
  if (!statement) {
    return false;
  }
  return statement[1]
    .split(',')
    .map((name) => name.trim())
    .some((name) => name === 'colors' || name === 'backgrounds');
}

/** Relative luminance per WCAG 2.1. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Every pairing a screen actually renders, with the bar each one has to clear.
 *
 * WCAG AA is 4.5:1 for body text and 3.0:1 for large text (headings here are
 * 19pt and up). Both grounds matter: text sits on `surface` inside cards and
 * directly on `paper` between them, and the second is the one that broke — the
 * wood theme's first ground was dark enough that `inkMuted` on it measured
 * under 2:1, which on device was a paragraph you could not read.
 */
const PAIRINGS: { name: string; on: keyof ThemePalette; text: keyof ThemePalette; min: number }[] =
  [
    { name: 'body on a card', on: 'surface', text: 'ink', min: 4.5 },
    { name: 'muted body on a card', on: 'surface', text: 'inkMuted', min: 4.5 },
    { name: 'body on the page', on: 'paper', text: 'ink', min: 4.5 },
    { name: 'muted body on the page', on: 'paper', text: 'inkMuted', min: 4.5 },
    { name: 'heading on a card', on: 'surface', text: 'headingGreen', min: 3 },
    { name: 'heading on the page', on: 'paper', text: 'headingGreen', min: 3 },
  ];

/**
 * The two screens that bring their own ground instead of sitting on `paper`.
 *
 * Both were written against one theme's ground and never re-measured. Results
 * put a honey title on the meadow's cerulean at 2.38:1 — under the 3.0 bar large
 * text gets, on the one screen whose whole job is to be read at a glance — and
 * Pack put white on a *light* mint at 1.73:1, which is text you can see is there
 * and cannot read.
 *
 * Keyed off `backgrounds` rather than `colors`, so this is a separate table from
 * the one above rather than a widened version of it.
 */
const GROUND_PAIRINGS: {
  name: string;
  on: keyof ThemeBackgrounds;
  text: keyof ThemePalette;
  min: number;
}[] = [
  { name: 'the celebration title', on: 'results', text: 'honey', min: 3 },
  { name: 'the celebration subtitle', on: 'results', text: 'onFill', min: 3 },
  { name: 'a pack heading', on: 'pack', text: 'ink', min: 3 },
  { name: 'pack body copy', on: 'pack', text: 'ink', min: 4.5 },
  { name: 'a pack header title', on: 'pack', text: 'headingGreen', min: 3 },
];

describe('theme contrast', () => {
  it.each(
    THEMES.flatMap((theme) =>
      PAIRINGS.map((pairing) => ({
        label: `${theme.name}: ${pairing.name}`,
        ratio: contrast(theme.colors[pairing.text], theme.colors[pairing.on]),
        min: pairing.min,
      })),
    ),
  )('$label clears its bar', ({ ratio, min }) => {
    expect(ratio).toBeGreaterThanOrEqual(min);
  });

  it.each(
    THEMES.flatMap((theme) =>
      GROUND_PAIRINGS.map((pairing) => ({
        label: `${theme.name}: ${pairing.name}`,
        ratio: contrast(theme.colors[pairing.text], theme.backgrounds[pairing.on]),
        min: pairing.min,
      })),
    ),
  )('$label clears its bar on its own ground', ({ ratio, min }) => {
    expect(ratio).toBeGreaterThanOrEqual(min);
  });
});

describe('themes', () => {
  it('ships at least two, or the picker has nothing to pick', () => {
    expect(THEMES.length).toBeGreaterThanOrEqual(2);
  });

  it('gives every theme a distinct id', () => {
    expect(new Set(THEMES.map((theme) => theme.id)).size).toBe(THEMES.length);
  });

  it('gives every theme every colour the meadow has', () => {
    // The type enforces this, but only while every theme is written by hand. A
    // theme built by spreading another could silently drop a key at runtime.
    for (const theme of THEMES) {
      for (const key of Object.keys(meadowColors)) {
        expect(typeof (theme.colors as Record<string, unknown>)[key]).toBe('string');
      }
    }
  });

  it('gives every theme a ground, whether flat or a material', () => {
    // A theme with neither a Home picture nor a texture is a flat rectangle,
    // which is what the wood theme was on every screen but Home.
    for (const theme of THEMES) {
      const hasMaterial = theme.groundTexture != null || theme.homeBackground != null;
      expect(hasMaterial).toBe(true);
    }
  });

  it('ships exactly one free theme, so a new player always has one', () => {
    expect(THEMES.filter((theme) => theme.price === 0)).toHaveLength(1);
  });

  it('defaults to a theme that costs nothing', () => {
    expect(themeById(DEFAULT_THEME_ID).price).toBe(0);
  });

  it('falls back rather than throwing on an id it does not know', () => {
    // A row written by a build that shipped a theme this one does not have.
    expect(themeById('lunar')).toBe(MEADOW);
    expect(themeById(null)).toBe(MEADOW);
    expect(themeById(undefined)).toBe(MEADOW);
  });

  it('leaves no colour behind where a theme cannot reach it', () => {
    // The board play area shipped as `#DCE9CD` — two points off the meadow's
    // own paper, so it looked right for as long as there was one theme. Under
    // the wood theme the entire app turned oak and the one surface the player
    // actually stares at stayed sage.
    const offenders = sourceFiles(SRC)
      .filter((file) => {
        const rel = path.relative(SRC, file).split(path.sep).join('/');
        return !PALETTE_LAYER.includes(rel) && !MATERIAL.includes(rel);
      })
      .filter((file) => /#[0-9a-fA-F]{6}/.test(readFileSync(file, 'utf8')))
      .map((file) => path.relative(SRC, file).split(path.sep).join('/'));

    expect(offenders).toEqual([]);
  });

  it('is the only way the app reads a palette', () => {
    // One static import is enough to freeze a screen on the meadow: its styles
    // are built at import, and no theme change can reach them afterwards.
    const offenders = sourceFiles(SRC)
      .filter((file) => {
        const rel = path.relative(SRC, file).split(path.sep).join('/');
        return !PALETTE_LAYER.includes(rel);
      })
      .filter((file) => importsStaticPalette(readFileSync(file, 'utf8')))
      .map((file) => path.relative(SRC, file).split(path.sep).join('/'));

    expect(offenders).toEqual([]);
  });
});
