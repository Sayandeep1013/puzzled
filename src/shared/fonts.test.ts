import { existsSync, readFileSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';

import { fonts, typography } from './theme';

/**
 * Guards the one invariant that keeps text measuring and painting in the same
 * face: every family `theme.ts` names is embedded in the binary by the
 * `expo-font` config plugin.
 *
 * Loading a family at runtime only — `useFonts` with nothing embedded — is what
 * cut the ends off labels on other people's phones: Android measures the first
 * pass in the system fallback, paints the second in the real face, and never
 * re-measures the box in between. The full account is on `fonts` in `theme.ts`.
 *
 * These assertions exist because the failure is silent. Nothing throws, nothing
 * logs, and it does not reproduce at all on a device whose font scale is below
 * 1.0 — so a family added to the theme and forgotten here would ship, look
 * correct on the phone it was reviewed on, and lose letters on everyone else's.
 */

const projectRoot = resolve(__dirname, '..', '..');

interface FontPluginProps {
  fonts?: string[];
}

/** The paths the `expo-font` plugin embeds, exactly as `app.json` declares them. */
function declaredFontPaths(): string[] {
  const appJson = JSON.parse(readFileSync(join(projectRoot, 'app.json'), 'utf8')) as {
    expo: { plugins: (string | [string, unknown])[] };
  };

  const entry = appJson.expo.plugins.find(
    (plugin): plugin is [string, FontPluginProps] =>
      Array.isArray(plugin) && plugin[0] === 'expo-font',
  );

  return entry?.[1].fonts ?? [];
}

describe('font embedding', () => {
  const declared = declaredFontPaths();

  it('configures the expo-font plugin at all', () => {
    // Without this entry nothing reaches `assets/fonts/`, and every assertion
    // below is meaningless rather than failing.
    expect(declared.length).toBeGreaterThan(0);
  });

  it('embeds every family the theme names', () => {
    // Android takes the family name from the filename, so the two must match
    // character for character — `Nunito_700Bold.ttf` and nothing else.
    const embedded = declared.map((path) => basename(path, extname(path)));
    for (const family of Object.values(fonts)) {
      expect(embedded).toContain(family);
    }
  });

  it('embeds nothing the theme does not use', () => {
    // A file listed here but unused is dead weight in the APK, and usually the
    // trace of a family that was renamed on one side of the pair only.
    const used: string[] = Object.values(fonts);
    for (const path of declared) {
      expect(used).toContain(basename(path, extname(path)));
    }
  });

  it('points at files that exist, in a format Android can load', () => {
    for (const path of declared) {
      // The plugin silently drops anything that is not a font file, so a typo
      // in a path would embed nothing at all rather than failing the build.
      expect(['.ttf', '.otf']).toContain(extname(path));
      expect(existsSync(resolve(projectRoot, path))).toBe(true);
    }
  });

  it('names a family every type style can resolve', () => {
    // `typography` is what screens actually reach for; a style pointing at a
    // family outside `fonts` would skip both checks above.
    const known: string[] = Object.values(fonts);
    const strays = Object.entries(typography)
      .filter(([, style]) => !known.includes(style.fontFamily))
      .map(([name, style]) => `${name}: ${style.fontFamily}`);
    expect(strays).toEqual([]);
  });
});
