import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { border, colors, radii, shadow, spacing, springs, typography } from '@/shared/theme';

export type PopTone =
  | 'grape'
  | 'bubblegum'
  | 'tangerine'
  | 'sunshine'
  | 'mint'
  | 'sky'
  | 'cherry'
  | 'surface';

const FILL: Record<PopTone, string> = {
  grape: colors.grape,
  bubblegum: colors.bubblegum,
  tangerine: colors.tangerine,
  sunshine: colors.sunshine,
  mint: colors.mint,
  sky: colors.sky,
  cherry: colors.cherry,
  surface: colors.surface,
};

/** Sunshine and mint are light enough that white text fails contrast on them. */
const LABEL: Record<PopTone, string> = {
  grape: colors.onFill,
  bubblegum: colors.onFill,
  tangerine: colors.onFill,
  sunshine: colors.ink,
  mint: colors.ink,
  sky: colors.ink,
  cherry: colors.onFill,
  surface: colors.ink,
};

const SIZE = {
  sm: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, fontSize: 15, radius: radii.sm },
  md: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg, fontSize: 18, radius: radii.md },
  lg: { paddingVertical: spacing.md + 4, paddingHorizontal: spacing.xl, fontSize: 22, radius: radii.lg },
} as const;

interface PopButtonProps {
  label: string;
  onPress?: () => void;
  tone?: PopTone;
  size?: keyof typeof SIZE;
  disabled?: boolean;
  /** Rendered before the label — pass a `PopIcon`. */
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function PopButton({
  label,
  onPress,
  tone = 'grape',
  size = 'md',
  disabled = false,
  icon,
  style,
  accessibilityLabel,
}: PopButtonProps) {
  const press = useSharedValue(0);
  const metrics = SIZE[size];
  const travel = shadow.default - shadow.pressed;

  // Only the face moves. The shadow stays put, so the gap between them shrinks
  // from `shadow.default` to `shadow.pressed` — the button presses into the page.
  const faceStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: press.value * travel },
      { translateY: press.value * travel },
    ],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => {
        press.value = withSpring(1, springs.snappy);
      }}
      onPressOut={() => {
        press.value = withSpring(0, springs.pop);
      }}
      style={[{ paddingRight: shadow.default, paddingBottom: shadow.default }, disabled && styles.disabled, style]}
    >
      <View
        pointerEvents="none"
        style={[styles.shade, { left: shadow.default, top: shadow.default, borderRadius: metrics.radius }]}
      />
      <Animated.View
        style={[
          styles.face,
          {
            backgroundColor: FILL[tone],
            borderRadius: metrics.radius,
            paddingVertical: metrics.paddingVertical,
            paddingHorizontal: metrics.paddingHorizontal,
          },
          faceStyle,
        ]}
      >
        {icon}
        <Text style={[styles.label, { color: LABEL[tone], fontSize: metrics.fontSize }]}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shade: { position: 'absolute', right: 0, bottom: 0, backgroundColor: colors.ink },
  face: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: border.standard,
    borderColor: colors.ink,
  },
  label: { fontFamily: typography.heading.fontFamily },
  disabled: { opacity: 0.45 },
});
