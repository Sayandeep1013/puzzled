/// <reference types="node" />
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { colors as meadowColors } from './tokens';
import { DEFAULT_THEME_ID, MEADOW, THEMES, themeById } from './themes';

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
