import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { border, colors, radii, shadow, springs } from '@/shared/theme';

import { PopSurface } from './PopSurface';

const TRACK_WIDTH = 52;
const TRACK_HEIGHT = 30;
const KNOB_SIZE = 22;
const KNOB_PAD = 4;
const TRAVEL = TRACK_WIDTH - KNOB_SIZE - KNOB_PAD * 2;

interface PopToggleProps {
  value: boolean;
  onChange: (next: boolean) => void;
  accessibilityLabel: string;
}

/** A pill-shaped ink-outlined switch: the knob overshoots into place on flip. */
export function PopToggle({ value, onChange, accessibilityLabel }: PopToggleProps) {
  const on = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    on.value = withSpring(value ? 1 : 0, springs.pop);
  }, [on, value]);

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: on.value * TRAVEL }],
  }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={accessibilityLabel}
      onPress={() => onChange(!value)}
    >
      <PopSurface
        radius={radii.pill}
        offset={shadow.pressed}
        fill={value ? colors.mint : colors.surface}
        contentStyle={styles.track}
      >
        <Animated.View style={[styles.knob, knobStyle]} />
      </PopSurface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: KNOB_PAD,
  },
  knob: {
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: radii.pill,
    borderWidth: border.standard,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
  },
});
