// Node globals are referenced here rather than added to tsconfig's `types`, so
// `fs`/`__dirname` stay out of scope for the app code, which has no filesystem.
/// <reference types="node" />
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import appJson from '../../app.json';

import { backgrounds } from './tokens';

/**
 * Guards the Android splash icon against the circular mask.
 *
 * Android 12+ renders `windowSplashScreenAnimatedIcon` on a 288dp canvas and
 * masks it to a **192dp circle**. Everything outside that circle is cut away, and
 * nothing in the expo-splash-screen config can turn the mask off.
 *
 * `expo-splash-screen`'s plugin scales our image to `imageWidth` dp and centres it
 * on that 288dp canvas — see `withAndroidSplashImages.js`,
 * `setSplashImageDrawablesForThemeAsync`, where `size = imageWidth * multiplier`
 * and `canvasSize = 288 * multiplier`. So the bear's rendered diameter is
 * `imageWidth × CONTENT_DIAMETER_RATIO`, and that is what must fit in 192dp.
 *
 * The bear was shipped at `imageWidth: 254`, giving a ~260dp content diameter
 * against a 192dp mask — its raised arm, ears and feet were sliced off, which is
 * what "the loading screen bear is cut off in a circle" was.
 */

const ANDROID_SPLASH_CANVAS_DP = 288;
const ANDROID_SPLASH_SAFE_CIRCLE_DP = 192;

/**
 * Fraction of `imageWidth` the bear's opaque pixels actually span, measured on
 * `splash-bear.png` as `2 × maxRadiusFromCentre / width`. It exceeds 1.0 because
 * the artwork is drawn to the very corners of its square canvas, so its diagonal
 * reach is wider than the canvas itself.
 *
 * Measured, not guessed — and only valid for the exact asset pinned below.
 */
const CONTENT_DIAMETER_RATIO = 1.024;

/**
 * The asset `CONTENT_DIAMETER_RATIO` was measured from. If the art changes, this
 * fails: re-measure the ratio against the new file rather than bumping the hash,
 * because a differently-cropped bear needs a different `imageWidth`.
 */
const MEASURED_ASSET_SHA256 = 'd4c05514495ba3a8d18d86db5a92a7937ab0fe2e50e2975e4166f65a34c3f367';

/**
 * `app.json` imports with its literal shape, which types every plugin entry as
 * its own tuple and makes a lookup by name unassignable. Widening once here keeps
 * the assertions below readable.
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

describe('android splash icon', () => {
  const config = splashPluginConfig();

  it('is still the asset the content ratio was measured from', () => {
    const assetPath = path.join(__dirname, '../..', String(config.image));
    const actual = createHash('sha256').update(readFileSync(assetPath)).digest('hex');
    expect(actual).toBe(MEASURED_ASSET_SHA256);
  });

  it('fits inside the 192dp circular mask, so the bear is not cut off', () => {
    const imageWidth = Number(config.imageWidth);
    const contentDiameterDp = imageWidth * CONTENT_DIAMETER_RATIO;

    expect(contentDiameterDp).toBeLessThanOrEqual(ANDROID_SPLASH_SAFE_CIRCLE_DP);
    // And it must not shrink to nothing chasing that ceiling.
    expect(contentDiameterDp).toBeGreaterThan(ANDROID_SPLASH_SAFE_CIRCLE_DP * 0.85);
  });

  it('never asks for an image wider than the canvas the plugin composites onto', () => {
    expect(Number(config.imageWidth)).toBeLessThanOrEqual(ANDROID_SPLASH_CANVAS_DP);
  });

  it('shares its background with the loading screen that replaces it', () => {
    // `LoadingScreen` fills the screen with `backgrounds.homeSky` and takes over
    // the moment the native splash hides. If the two colours drift the handoff
    // becomes a visible flash of the wrong sky.
    expect(String(config.backgroundColor).toUpperCase()).toBe(backgrounds.homeSky.toUpperCase());
  });
});
