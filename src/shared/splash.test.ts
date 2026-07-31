import appJson from '../../app.json';

import { backgrounds } from './tokens';

/**
 * Keeps the app to **one** splash.
 *
 * The native splash used to draw a static bear, and the JS `LoadingScreen` that
 * replaces it draws an animated one beside the wordmark. Two bears back to back read
 * as two different loading screens however well the first was tuned — the previous
 * round of work here was spent sizing that bear against Android 12+'s 192dp circular
 * mask, which stopped it being *clipped* but could never stop it being a second
 * screen. The icon is gone instead.
 *
 * Android always draws something before JS is alive, so the native phase cannot be
 * removed. With no icon it is a flat fill, and `LoadingScreen` opening on the same
 * colour continues it rather than replacing it.
 */

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

  it('declares no icon, so only the loading screen shows a bear', () => {
    // The whole point. An `image` here brings back the static first bear, and the
    // two-splash effect with it — which is a design regression, not a rendering one,
    // so nothing else in the codebase would catch it.
    expect(config.image).toBeUndefined();
    expect(config.imageWidth).toBeUndefined();
  });

  it('shares its background with the loading screen that replaces it', () => {
    // `LoadingScreen` fills the screen with `backgrounds.homeSky` and takes over the
    // moment the native splash hides. With no icon to look at, this colour is the
    // *only* thing tying the two phases together: if they drift, the handoff becomes
    // a flash of the wrong sky and the seam is visible again.
    expect(String(config.backgroundColor).toUpperCase()).toBe(backgrounds.homeSky.toUpperCase());
  });
});
