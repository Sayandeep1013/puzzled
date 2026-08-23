// Node globals are referenced here rather than added to tsconfig's `types`, so
// `fs`/`__dirname` stay out of scope for the app code, which has no filesystem.
/// <reference types="node" />
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import appJson from '../../app.json';

import {
  LOADING_BEAR_MAX,
  loadingBearSize,
  loadingBearStartScale,
  nativeSplashRenderedWidth,
} from './splash';
import { splash } from './tokens';

/**
 * Keeps the launch reading as **one** screen.
 *
 * Android draws its splash window from the moment the icon is tapped until React
 * Native has a frame — around a second on this app. That window cannot be removed,
 * only dressed, so the goal is for it to be indistinguishable from the
 * `LoadingScreen` that replaces it. Three things have to agree for that:
 *
 * 1. **The same background**, or the handoff is a flash of the wrong sky.
 * 2. **The same bear**, centred, *at the same size*. Android centres
 *    `windowSplashScreenAnimatedIcon`, so `LoadingScreen` centres its bear too
 *    and anchors the wordmark and dots below that centre instead of stacking
 *    them in a column that pushes the bear up — and it opens at the native
 *    icon's width before growing, so the size does not jump either.
 * 3. **A bear that survives the mask.** Android 12+ renders the icon on a 288dp
 *    canvas and masks it to a 192dp circle, and nothing in the plugin config turns
 *    that off — so an oversized icon loses its arm, ears and feet.
 *
 * Three failure modes here have shipped: a bear at `imageWidth: 254` clipped by
 * the mask; no bear at all, which merely moved the seam rather than removing it
 * — and, because the plugin writes the drawable reference into `styles.xml`
 * unconditionally, broke the Android build outright; and a size mismatch that
 * this file's own test could not see, because it compared the two bears at a
 * hardcoded 360dp screen width, which is the one width at which they nearly
 * agreed. The width table below is the fix for that.
 */

/**
 * Screen widths in dp, spanning what this app actually runs on: a small budget
 * phone, the long-standing 360dp baseline, a Pixel, a large Android flagship, an
 * iPhone Pro Max, and a tablet.
 *
 * The old assertion used 360 alone. On the 393–412dp devices most people hold,
 * the loading bear was 16–22% larger than the native one and the test passed
 * anyway.
 */
const DEVICE_WIDTHS_DP = [320, 360, 384, 393, 412, 428, 768];

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

describe('native splash', () => {
  const config = splashPluginConfig();

  it('declares an image, which the Android build requires', () => {
    // `withAndroidSplashStyles` writes `windowSplashScreenAnimatedIcon` into
    // styles.xml whether or not a drawable is generated, so dropping `image` leaves
    // the theme pointing at a missing resource and aapt2 fails the release build.
    // That is not a hypothetical: it is how CI run 15 died, with typecheck, lint
    // and every test green, because nothing before Gradle can see a resource error.
    expect(config.image).toBeDefined();
  });

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

  it('is the width the loading screen was built against', () => {
    // `app.json` cannot import from `tokens.ts`, so the two are pinned to each
    // other here instead. Changing one without the other reopens the seam.
    expect(Number(config.imageWidth)).toBe(splash.iconWidth);
  });

  it('shares its background with the loading screen that replaces it', () => {
    expect(String(config.backgroundColor).toUpperCase()).toBe(splash.background.toUpperCase());
  });

  it('hands over at exactly the same bear size on every device width', () => {
    // Not "close enough on one phone" — identical, on all of them. The loading
    // screen opens at the native icon's width and grows from there, so its first
    // painted frame has to measure the same as the splash window's last one
    // whatever the screen is.
    for (const width of DEVICE_WIDTHS_DP) {
      const startsAt = loadingBearSize(width) * loadingBearStartScale(width);
      // Against what Android *renders*, not against the `imageWidth` requested —
      // the two differ by ~3%, which is a visible residual on a 175dp bear.
      expect(startsAt).toBeCloseTo(nativeSplashRenderedWidth(), 5);
    }
  });

  it('grows into place rather than shrinking, on every device width', () => {
    // The bear ends larger than it starts everywhere, including the narrow
    // phones where `width * 0.52` alone would have fallen below the icon width
    // and turned the handoff into a visible shrink.
    for (const width of DEVICE_WIDTHS_DP) {
      expect(loadingBearStartScale(width)).toBeGreaterThan(0);
      expect(loadingBearStartScale(width)).toBeLessThanOrEqual(1);
      expect(loadingBearSize(width)).toBeGreaterThanOrEqual(nativeSplashRenderedWidth());
    }
  });

  it('never draws the bear larger than the @3x art can carry', () => {
    for (const width of DEVICE_WIDTHS_DP) {
      expect(loadingBearSize(width)).toBeLessThanOrEqual(LOADING_BEAR_MAX);
    }
  });
});
