// Node globals are referenced here rather than added to tsconfig's `types`, so
// `fs`/`__dirname` stay out of scope for the app code, which has no filesystem.
/// <reference types="node" />
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import appJson from '../../app.json';

import { backgrounds } from './tokens';

/**
 * Keeps the app to **one** splash.
 *
 * The native splash used to draw a static bear, and the JS `LoadingScreen` that
 * replaces it draws an animated one beside the wordmark. Two bears back to back read
 * as two different loading screens however well the first is tuned — an earlier round
 * here was spent sizing that bear against Android 12+'s 192dp circular mask, which
 * stopped it being *clipped* but could never stop it being a second screen.
 *
 * The icon is therefore a fully transparent image, so the native phase is a flat fill
 * of `backgrounds.homeSky` that `LoadingScreen` continues rather than replaces.
 * Android always draws something before JS is alive, so that phase cannot be removed —
 * only made indistinguishable.
 *
 * ## Why not simply omit `image`
 *
 * Because it does not build. `withAndroidSplashStyles` writes
 * `windowSplashScreenAnimatedIcon → @drawable/splashscreen_logo` into `styles.xml`
 * *unconditionally*, while the drawable is only generated when an image is configured.
 * Dropping `image` leaves the theme pointing at a resource that does not exist and
 * `aapt2` fails the release build — which is exactly how CI run 15 died, after
 * typecheck, lint and tests had all passed. A transparent image satisfies the
 * reference and draws nothing.
 */

/** Regenerate with: `Image.new('RGBA', (96, 96), (0, 0, 0, 0)).save(...)`. */
const TRANSPARENT_ASSET_SHA256 = 'e93cf7cf69e59a49eaaa011e5f0ec7b6e385408ba1b4025b9231832d7c87ec46';

/**
 * `app.json` imports with its literal shape, which types every plugin entry as its
 * own tuple and makes a lookup by name unassignable. Widening once here keeps the
 * assertions below readable.
 */
type PluginEntry = string | [string, Record<string, unknown>];

function splashPluginConfig(): Record<string, unknown> {
  const plugins = appJson.expo.plugins as unknown as PluginEntry[];
  const entry = plugins.find(
    (plugin): plugin is [string, Record<string, unknown>] =>
      Array.isArray(plugin) && plugin[0] === 'expo-splash-screen',
  );
  if (!entry) {
    throw new Error('expo-splash-screen is not configured in app.json');
  }
  return entry[1];
}

describe('native splash', () => {
  const config = splashPluginConfig();

  it('still declares an image, or the Android build cannot link', () => {
    // The plugin's `styles.xml` references the drawable whether or not one is
    // generated, so this is a build requirement, not a design choice.
    expect(config.image).toBeDefined();
  });

  it('draws nothing, so only the loading screen shows a bear', () => {
    // Pinned by hash: swapping in real art here brings back the static first bear and
    // the two-splash effect with it. That is a design regression rather than a
    // structural one, so nothing else in the codebase would catch it.
    const assetPath = path.join(__dirname, '../..', String(config.image));
    const actual = createHash('sha256').update(readFileSync(assetPath)).digest('hex');
    expect(actual).toBe(TRANSPARENT_ASSET_SHA256);
  });

  it('shares its background with the loading screen that replaces it', () => {
    // `LoadingScreen` fills the screen with `backgrounds.homeSky` and takes over the
    // moment the native splash hides. With a transparent icon this colour is the
    // *only* thing tying the two phases together: if they drift, the handoff becomes
    // a flash of the wrong sky and the seam is visible again.
    expect(String(config.backgroundColor).toUpperCase()).toBe(backgrounds.homeSky.toUpperCase());
  });
});
