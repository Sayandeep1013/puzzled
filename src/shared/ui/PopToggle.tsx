import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { radii, shadow, springs } from '@/shared/theme';
import { useTheme } from '@/shared/theme-context';
import { createThemedStyles } from '@/shared/themed-styles';

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

/** A pill switch: the knob overshoots into place on flip. */
export function PopToggle({ value, onChange, accessibilityLabel }: PopToggleProps) {
  const theme = useTheme();
  const styles = useStyles();
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
        elevation="pressed"
        // Off reads as an empty groove rather than a card, so it takes the
        // muted ground colour instead of the cream surface.
        fill={value ? theme.colors.grass : theme.colors.locked}
        contentStyle={styles.track}
      >
        <Animated.View style={[styles.knob, knobStyle]} />
      </PopSurface>
    </Pressable>
  );
}

const useStyles = createThemedStyles((theme) =>
  StyleSheet.create({
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
      backgroundColor: theme.colors.white,
      boxShadow: shadow.pressed,
    },
  }),
);
