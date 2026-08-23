import { type ReactNode, useEffect } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { motion } from '@/shared/theme';

/**
 * The two reusable motions in the app, so screens describe *what* moves and never
 * restate the timing.
 *
 * Both run entirely on the UI thread via Reanimated, which matters on entrance in
 * particular: a screen animates in while its JS thread is still reading SQLite, and
 * a JS-driven animation would stutter at exactly that moment.
 */

interface EnterViewProps {
  children: ReactNode;
  /**
   * Position in a group, which sets the delay. Siblings passing 0, 1, 2… fade in as
   * a wave, so the eye reads the group in order rather than seeing it appear at once.
   */
  index?: number;
  /** Points the content rises through as it fades in. */
  distance?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Fades and lifts its children into place once, on mount. */
export function EnterView({ children, index = 0, distance = 16, style, testID }: EnterViewProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      index * motion.stagger,
      withTiming(1, { duration: motion.enter, easing: Easing.out(Easing.cubic) }),
    );
  }, [progress, index]);

  const animated = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * distance }],
  }));

  return (
    <Animated.View style={[style, animated]} testID={testID}>
      {children}
    </Animated.View>
  );
}

interface IdleBobProps {
  children: ReactNode;
  /** Points travelled between the top and bottom of each breath. */
  distance?: number;
  /** Degrees of rock either side of upright, in phase with the bob. */
  sway?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Breathes its children up and down forever — for a mascot, which looks stuffed
 * rather than alive when perfectly still.
 *
 * Timed rather than sprung: a repeating spring accumulates error and drifts out of
 * its starting position over the minutes a mascot stays on screen.
 */
export function IdleBob({ children, distance = 8, sway = 0, style, testID }: IdleBobProps) {
  const breathe = useSharedValue(0);

  useEffect(() => {
    breathe.value = withRepeat(
      withTiming(1, { duration: motion.idle, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [breathe]);

  const animated = useAnimatedStyle(() => ({
    transform: [
      { translateY: -breathe.value * distance },
      { rotateZ: `${(breathe.value * 2 - 1) * sway}deg` },
    ],
  }));

  return (
    <Animated.View style={[style, animated]} testID={testID}>
      {children}
    </Animated.View>
  );
}
