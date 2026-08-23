/**
 * Lets a development build install *alongside* the real app instead of replacing it.
 *
 * The two are signed by different keys — CI signs with the debug key, EAS with its own
 * keystore — so Android refuses to update one with the other and the only way to swap
 * them is an uninstall, which wipes the save. That cost a real one: a device debugging
 * session would have taken the player's coins and their half-finished puzzle with it,
 * and `adb backup` cannot rescue it (Android 12+ omits app data for a non-debuggable
 * app, so the archive comes back empty however many times the prompt is confirmed).
 *
 * Under `APP_VARIANT=development` the build takes its own package id, scheme and name,
 * so it is a separate app to Android and shares nothing with the installed one.
 * `eas.json` sets that variable on the `development` profile only — CI leaves it unset
 * and so keeps building `com.puzzled.app` exactly as before.
 *
 * `app.json` stays the single source of truth for everything else; this only overrides
 * the three fields that decide identity.
 */
module.exports = ({ config }) => {
  if (process.env.APP_VARIANT !== 'development') {
    return config;
  }

  return {
    ...config,
    // Suffixed rather than renamed, so the two sort together on the home screen.
    name: `${config.name} (dev)`,
    // The scheme is how a dev client is launched by deep link. Both apps claiming
    // `puzzled://` would make which one opens a coin toss.
    scheme: `${config.scheme}-dev`,
    ios: { ...config.ios, bundleIdentifier: `${config.ios.bundleIdentifier}.dev` },
    android: { ...config.android, package: `${config.android.package}.dev` },
  };
};
