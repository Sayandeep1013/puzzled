import { splash } from './tokens';

/**
 * Launch-screen geometry, kept free of React so the handoff arithmetic can be
 * checked directly — including at the device widths nobody develops on.
 *
 * The bug this exists to prevent is not visible in code review and not visible
 * on a 360dp emulator: the native splash bear and the loading screen bear were
 * sized by two unrelated formulas that agreed at one width and nowhere else.
 */

/**
 * Largest the bear is ever drawn, in points — the size the @3x art can carry
 * without softening.
 */
export const LOADING_BEAR_MAX = 240;

/**
 * What Android actually draws, as a multiple of the `imageWidth` requested in
 * `app.json`.
 *
 * It is not 1.0, which is the trap: `imageWidth` is what the plugin composites
 * at, not what the system renders. Android 12+ takes the generated drawable and
 * scales it into its own splash icon canvas, and the round trip through the
 * density buckets comes back slightly larger.
 *
 * Measured, not guessed — on a 1080x2392 device (A059, 420dpi):
 *
 * - Native splash bear: 391px across, six cold starts, identical every time.
 * - `bear.png` is square with transparent padding; its opaque content spans
 *   0.8202 of its layout box, cross-checked two ways on the same device (Home's
 *   254dp mascot measured 208.4dp; the loading screen's 213.9dp bear measured
 *   175.4dp).
 * - So the native bear occupies 391 / 2.625 / 0.8202 = 181.7dp, against the 176
 *   requested. A second reading at an overridden 480dpi gave 180.9dp — 1.028x.
 *
 * The caveat: this is one handset. If it turns out to differ per device, the
 * error is ~3%, which is where this sat anyway before the factor existed — so
 * the factor cannot make things meaningfully worse, and on the device we can
 * actually measure it makes the handoff exact.
 */
const NATIVE_RENDER_FACTOR = 1.032;

/**
 * On-screen width of the native splash's bear, in points.
 *
 * This — not `splash.iconWidth` — is what the loading screen has to match, and
 * confusing the two is worth 3% of a seam.
 */
export function nativeSplashRenderedWidth(): number {
  return splash.iconWidth * NATIVE_RENDER_FACTOR;
}

/** Fraction of the screen width the bear aims for. */
const LOADING_BEAR_WIDTH_FRACTION = 0.52;

/**
 * Bear size on the loading screen, in points.
 *
 * Floored at the native splash's icon width, not merely capped at
 * `LOADING_BEAR_MAX`. Without the floor, a phone narrow enough that
 * `width * 0.52` falls below `splash.iconWidth` would draw a bear *smaller*
 * than the one the native window just showed, and the handoff would be a visible
 * shrink rather than the growth it is everywhere else. The floor costs nothing —
 * on a 320dp phone it makes the bear 55% of the width instead of 52%.
 */
export function loadingBearSize(screenWidth: number): number {
  return Math.max(
    nativeSplashRenderedWidth(),
    Math.min(screenWidth * LOADING_BEAR_WIDTH_FRACTION, LOADING_BEAR_MAX),
  );
}

/**
 * Scale the loading screen's bear starts at, so its first painted frame is the
 * same size as the native splash's last one.
 *
 * `loadingBearSize(w) * loadingBearStartScale(w)` is `nativeSplashRenderedWidth()`
 * at every width, by construction — which is the property `splash.test.ts` pins,
 * and the one the old hardcoded `imageWidth`/`min(360 * 0.52, 240)` comparison
 * only had at 360dp.
 */
export function loadingBearStartScale(screenWidth: number): number {
  return nativeSplashRenderedWidth() / loadingBearSize(screenWidth);
}
