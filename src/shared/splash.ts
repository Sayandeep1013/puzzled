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

/**
 * Bear size on the loading screen, in points: exactly what the native splash
 * draws, on every screen.
 *
 * Not a fraction of the screen, and **not animated**. Two attempts tried to have
 * the loading screen grow the bear from the splash's size to a larger one, and
 * both failed on device for the same reason — the growth was over before anyone
 * could see it:
 *
 * 1. Started on mount. But `LoadingScreen` mounts behind the native splash, so
 *    the spring ran while hidden. Measured: native bear 149.0dp, first visible
 *    loading frame 179.8dp, 30ms later, already decaying from the overshoot.
 * 2. Started when `SplashScreen.hideAsync()` resolved. No better — that promise
 *    resolves when the *call* completes, not when Android has finished its own
 *    splash exit animation, so the spring still ran against a window that was
 *    still on screen. A 30ms-resolution phase sweep across nine cold starts
 *    never once caught the bear below 176dp, and cold-start timing wandered
 *    +/-100ms run to run, which is why no fixed delay would have fixed it either.
 *
 * The lesson is that the teardown of a system-owned window is not an event this
 * app can synchronise an animation to. So the size stops changing: the bear is
 * the same size before and after, and the handoff is seamless by construction
 * rather than by timing. Aliveness comes from the bob and from the wordmark and
 * dots rising in beneath it, neither of which can produce a jump.
 */
export const LOADING_BEAR_SIZE = nativeSplashRenderedWidth();
