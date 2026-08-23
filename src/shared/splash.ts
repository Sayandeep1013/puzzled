/**
 * Launch-screen geometry, kept free of React so the handoff arithmetic can be
 * checked directly — including at the device widths nobody develops on.
 *
 * The bug this exists to prevent is not visible in code review and not visible
 * on a 360dp emulator: the native splash bear and the loading screen bear were
 * sized by two unrelated formulas that agreed at one width and nowhere else.
 */

/**
 * The layout width that makes React Native draw the bear at the size Android's
 * splash window draws it — 178 points.
 *
 * Calibrated end to end on device, not derived. A derivation was tried and came
 * out 2% wrong, because it multiplied two ratios that are not the same ratio:
 * the fraction of its canvas the bear's opaque pixels fill differs slightly
 * between the system's splash-icon path and RN's `Image` + `resizeMode:
 * "contain"` path, and both differ from `app.json`'s requested `imageWidth`.
 * Chaining them accumulated the error instead of cancelling it.
 *
 * So this is measured against the only thing that matters — what is actually on
 * screen — on a 1080x2392 device (Nothing A059, 420dpi):
 *
 * - Native splash bear: 391px across, identical on every one of eight cold
 *   starts, which is 149.0dp.
 * - At a layout width of 181.6dp the loading screen drew 152.0dp: +2.0%.
 * - 181.6 x (149.0 / 152.0) = 178.0dp, which draws 149.0dp.
 *
 * `app.json` still requests `imageWidth: 176`; that number sizes the *generated
 * drawable*, and the system rescales it. The two are related but not equal, and
 * `splash.test.ts` pins both so neither can drift alone.
 *
 * If the art or `imageWidth` changes, re-measure rather than re-deriving: run a
 * cold start, screenshot during the native splash and during the loading screen,
 * and compare the bear's pixel span in each.
 */
export const LOADING_BEAR_SIZE = 178;
