import { StyleSheet, View } from 'react-native';

import { border, colors, radii, shadow } from '@/shared/theme';

interface PopProgressProps {
  value: number;
  goal: number;
  tone?: string;
  height?: number;
  testID?: string;
}

export function PopProgress({
  value,
  goal,
  tone = colors.mint,
  height = 18,
  testID,
}: PopProgressProps) {
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
          { width: `${fraction * 100}%`, backgroundColor: tone, borderRadius: radii.pill },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: colors.surface,
    borderWidth: border.thin,
    borderColor: colors.ink,
    overflow: 'hidden',
    marginBottom: shadow.pressed,
  },
  fill: { height: '100%' },
});
