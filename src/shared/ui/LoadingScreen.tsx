import { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { loadingBearSize, loadingBearStartScale } from '@/shared/splash';
import { colors, motion, splash, springs, typography } from '@/shared/theme';

import { Art } from './Art';
import { WordmarkTitle } from './WordmarkTitle';
import { Text } from './Text';

/**
 * The launch screen. The native splash is its first frame, not a screen before it.
 *
 * Android draws a splash window from the tap until React Native has a frame, and
 * it cannot be removed — only made indistinguishable from what replaces it. So
 * this opens with its bear at exactly `splash.iconWidth`, dead centre, on
 * exactly `splash.background`: the same bear, the same size, the same place, on
 * the same sky. Nothing visibly changes at the handoff.
 *
 * *Then* it animates. The bear grows to its full size and starts breathing while
 * the wordmark, dots and caption rise in beneath it — so the moment reads as the
 * splash coming alive, which is the whole point of having an animated one.
 *
 * The previous version skipped the first half. It drew the bear at
 * `min(width * 0.52, 240)` immediately, which equals the native 176 only on a
 * 360dp phone; on a 412dp phone the bear jumped 22% larger at the exact instant
 * a wordmark, three dots and a caption appeared around it. That is two screens,
 * and it is what people saw.
 *
 * Everything here is Reanimated, which the app already ships and which runs the
 * animation on the UI thread — so the bear keeps bobbing smoothly while the
 * JS thread is busy opening the database and mounting the navigator behind this
 * overlay. That is the whole reason to animate a loading screen: it stays alive
 * exactly when the JS thread cannot.
 *
 * Rive and Lottie were both considered. Rive needs a native module, so it cannot
 * reach the device without a fresh 15-minute build, and it needs a `.riv` file
 * the team has not authored. Lottie *is* installed (see `AnimatedArt`) but has no
 * animation files either. Reanimated over the existing PNG needs neither, so this
 * ships today; `AnimatedArt` stays the seam for real Lottie art later.
 */

/** How far the bear rises and falls on each breath, in points. */
const BOB_DISTANCE = 14;
/** Degrees the bear rocks either side of upright while it bobs. */
const SWAY_DEGREES = 3.5;
/** Dots in the progress row. */
const DOT_COUNT = 3;

interface LoadingScreenProps {
  /**
   * Called once the overlay has finished fading out. The parent unmounts it here
   * rather than on a timer, so the app is never revealed mid-dissolve.
   */
  onDone: () => void;
  /**
   * Whether the work behind the overlay has finished. The overlay leaves only
   * when this is true *and* `motion.loaderMinimum` has elapsed, so a warm start
   * still shows one full bob instead of a two-frame flash.
   */
  ready?: boolean;
}

export function LoadingScreen({ onDone, ready = true }: LoadingScreenProps) {
  const { width } = useWindowDimensions();
  // Both from `@/shared/splash`, so the sizes the handoff depends on are testable
  // at widths other than the one an emulator happens to open at.
  const bearSize = loadingBearSize(width);
  const startScale = loadingBearStartScale(width);

  const intro = useSharedValue(0);
  const breathe = useSharedValue(0);
  const fade = useSharedValue(1);

  useEffect(() => {
    // Grow into place once, then breathe forever. The intro overshoots via a
    // spring; the idle loop is timed, because a repeating spring drifts.
    intro.value = withSpring(1, springs.pop);
    breathe.value = withRepeat(
      withTiming(1, { duration: motion.idle, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [intro, breathe]);

  useEffect(() => {
    if (!ready) {
      return;
    }
    // The floor is applied here rather than in the parent so the parent only has
    // to say "the work is done" and this owns how the screen leaves.
    fade.value = withDelay(
      motion.loaderMinimum,
      withTiming(0, { duration: motion.handoff, easing: Easing.in(Easing.quad) }, (finished) => {
        if (finished) {
          runOnJS(onDone)();
        }
      }),
    );
  }, [ready, fade, onDone]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  /*
   * The bear does not *appear* — it grows.
   *
   * It is already on screen when this mounts, drawn by the native splash window
   * at `splash.iconWidth`. So there is no entrance to play: starting anywhere
   * other than that size, or moving it, makes the handoff read as a second
   * screen arriving. It starts exactly where the splash left it and swells to
   * full size, which is a continuation rather than a replacement.
   *
   * The bob is scaled with it, so the breathing does not visibly change
   * amplitude as the bear grows.
   */
  const bearStyle = useAnimatedStyle(() => {
    const grow = startScale + (1 - startScale) * intro.value;
    return {
      transform: [
        { translateY: -breathe.value * BOB_DISTANCE * grow },
        { rotateZ: `${(breathe.value * 2 - 1) * SWAY_DEGREES}deg` },
        { scale: grow },
      ],
    };
  });

  const wordmarkStyle = useAnimatedStyle(() => ({
    opacity: intro.value,
    transform: [{ translateY: (1 - intro.value) * 18 }],
  }));

  return (
    <Animated.View
      style={[styles.overlay, overlayStyle]}
      // The app is already mounted underneath; announcing this overlay's decor
      // would talk over it. The status text below is the accessible signal.
      accessibilityViewIsModal
      testID="loading-screen"
    >
      {/* Dead centre, because that is where the native splash draws its icon.
          Android centres `windowSplashScreenAnimatedIcon` on the screen, so the
          bear can only line up across the handoff if this one is centred too —
          which it was not while the wordmark and dots shared the column and
          pushed it upward. */}
      <Animated.View style={bearStyle}>
        <Art name="bear" size={bearSize} testID="loading-bear" />
      </Animated.View>

      {/* Anchored below the centre rather than stacked under the bear, so adding
          or resizing anything here can never shift the bear off the native
          splash's position again. */}
      <View style={[styles.below, { top: '50%', marginTop: bearSize / 2 }]} pointerEvents="none">
        <Animated.View style={[styles.wordmark, wordmarkStyle]}>
          <WordmarkTitle scale={0.62} />
        </Animated.View>

        <View style={styles.dots} accessibilityRole="progressbar" accessibilityLabel="Loading">
          {Array.from({ length: DOT_COUNT }, (_, index) => (
            <LoadingDot key={index} index={index} />
          ))}
        </View>

        <Text style={styles.caption}>Getting your pieces ready…</Text>
      </View>
    </Animated.View>
  );
}

/**
 * One dot in the progress row, pulsing on a stagger so the row reads as a
 * left-to-right wave rather than three things blinking together.
 */
function LoadingDot({ index }: { index: number }) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    const step = 180;
    pulse.value = withDelay(
      index * step,
      withRepeat(
        withSequence(
          withTiming(1, { duration: step * 2, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: step * 2, easing: Easing.in(Easing.quad) }),
          // Hold at rest for the dots that follow, so the wave has a gap before
          // it restarts instead of running as a continuous shimmer.
          withTiming(0, { duration: step * DOT_COUNT }),
        ),
        -1,
      ),
    );
  }, [pulse, index]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.35 + pulse.value * 0.65,
    transform: [{ scale: 0.8 + pulse.value * 0.4 }],
  }));

  return <Animated.View style={[styles.dot, style]} />;
}

const styles = StyleSheet.create({
  overlay: {
    // `absoluteFill`, not `absoluteFillObject` — RN 0.86 dropped the latter.
    ...StyleSheet.absoluteFill,
    // Must equal the native splash's backgroundColor — that identity is what
    // makes the handoff invisible, and `splash.test.ts` asserts the two match.
    backgroundColor: splash.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Everything under the bear, pinned below screen centre so the bear stays on it. */
  below: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  wordmark: { marginTop: 4 },
  dots: { flexDirection: 'row', gap: 10, marginTop: 28 },
  dot: {
    width: 11,
    height: 11,
    borderRadius: 999,
    backgroundColor: colors.onFill,
  },
  caption: {
    ...typography.label,
    color: colors.headingBlue,
    marginTop: 14,
    letterSpacing: 0.8,
  },
});
