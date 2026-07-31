import { useEffect } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
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

import { backgrounds, colors, motion, springs, typography } from '@/shared/theme';

import { Art } from './Art';
import { WordmarkTitle } from './WordmarkTitle';

/**
 * The loading screen, and the only place the bear is ever seen whole.
 *
 * Android 12+ masks the native splash icon to a 192dp circle and offers no way
 * to opt out (see `src/shared/splash.test.ts`), so the native splash can only
 * ever show a small, static, circle-cropped bear. This takes over the instant
 * that splash hides, on the same `#8AE3F5` sky, so the two read as one screen —
 * the bear appears to grow out of the circle rather than being replaced.
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
  // The bear scales with the screen so it fills a phone without overflowing a
  // small one, but never grows past the size the @3x art can carry.
  const bearSize = Math.min(width * 0.52, 240);

  const intro = useSharedValue(0);
  const breathe = useSharedValue(0);
  const fade = useSharedValue(1);

  useEffect(() => {
    // Rise into place once, then breathe forever. The intro overshoots via a
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

  const bearStyle = useAnimatedStyle(() => ({
    opacity: intro.value,
    transform: [
      // Bob and sway are driven by the same value, so the rock is always in
      // phase with the rise — the bear leans into the top of each breath.
      { translateY: (1 - intro.value) * 40 - breathe.value * BOB_DISTANCE },
      { scale: 0.86 + intro.value * 0.14 },
      { rotateZ: `${(breathe.value * 2 - 1) * SWAY_DEGREES}deg` },
    ],
  }));

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
      <Animated.View style={bearStyle}>
        <Art name="bear" size={bearSize} testID="loading-bear" />
      </Animated.View>

      <Animated.View style={[styles.wordmark, wordmarkStyle]}>
        <WordmarkTitle scale={0.62} />
      </Animated.View>

      <View style={styles.dots} accessibilityRole="progressbar" accessibilityLabel="Loading">
        {Array.from({ length: DOT_COUNT }, (_, index) => (
          <LoadingDot key={index} index={index} />
        ))}
      </View>

      <Text style={styles.caption}>Getting your pieces ready…</Text>
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
    backgroundColor: backgrounds.homeSky,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
