import { StyleSheet, View } from 'react-native';

import { radii } from '@/shared/theme';
import { useTheme } from '@/shared/theme-context';

interface PopProgressProps {
  value: number;
  goal: number;
  /** Fill colour. Defaults to the active theme's primary. */
  tone?: string;
  height?: number;
  testID?: string;
}

export function PopProgress({ value, goal, tone, height = 16, testID }: PopProgressProps) {
  const theme = useTheme();
  const fill = tone ?? theme.colors.grass;
  // A zero goal is a legitimate state for an achievement with no target yet;
  // treat it as empty rather than letting it become NaN%.
  const fraction = goal > 0 ? Math.min(1, Math.max(0, value / goal)) : 0;

  return (
    <View
      testID={testID}
      // RNTL only treats a host View as an accessibility element (and thus
      // matchable by `getByRole`) when `accessible` is explicit — having an
      // `accessibilityRole` alone is not enough for its query heuristics.
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: goal, now: value }}
      style={[styles.track, { height, borderRadius: radii.pill }]}
    >
      <View
        testID={testID ? `${testID}-fill` : undefined}
        style={[
          styles.fill,
          { width: `${fraction * 100}%`, backgroundColor: fill, borderRadius: radii.pill },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // An inset groove rather than an outlined bar: the track is a shade of the
  // ground, so the fill is the only thing that reads as raised.
  track: {
    backgroundColor: 'rgba(90, 62, 24, 0.14)',
    overflow: 'hidden',
  },
  fill: { height: '100%' },
});
