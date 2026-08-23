import { type ReactNode } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { colors, radii, shadow, spacing, springs, typography } from '@/shared/theme';

import { Text } from './Text';

export type PopTone =
  'grass' | 'leaf' | 'sky' | 'berry' | 'blossom' | 'honey' | 'apricot' | 'cherry' | 'surface';

/**
 * Button faces, paired with the label colour that clears WCAG AA large-text
 * (3.0:1) on them. Exported so the contrast test checks the real table rather
 * than a copy of it.
 *
 * This palette is bright enough that white text fails on almost all of it — the
 * mockup's own white-on-green measures 2.21:1. Tones that want white therefore
 * use their `*Deep` variant; everything else takes ink on the bright value.
 * Verified ratios are in the trailing comments.
 */
export const TONE_FILL: Record<PopTone, string> = {
  grass: colors.grassDeep,
  leaf: colors.leaf,
  sky: colors.skyDeep,
  berry: colors.berry,
  blossom: colors.blossom,
  honey: colors.honey,
  apricot: colors.apricot,
  cherry: colors.cherry,
  surface: colors.surface,
};

export const TONE_LABEL: Record<PopTone, string> = {
  grass: colors.onFill, // 3.25
  leaf: colors.ink, // 6.63
  sky: colors.onFill, // 3.21
  berry: colors.onFill, // 3.60
  blossom: colors.ink, // 6.11
  honey: colors.ink, // 10.08
  apricot: colors.ink, // 6.45
  cherry: colors.onFill, // 3.64
  surface: colors.ink, // 12.47
};

const SIZE = {
  sm: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    fontSize: 15,
    radius: radii.sm,
  },
  md: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    fontSize: 18,
    radius: radii.md,
  },
  lg: {
    paddingVertical: spacing.md + 4,
    paddingHorizontal: spacing.xl,
    fontSize: 22,
    radius: radii.lg,
  },
} as const;

interface PopButtonProps {
  label: string;
  onPress?: () => void;
  tone?: PopTone;
  size?: keyof typeof SIZE;
  disabled?: boolean;
  /** Rendered before the label — pass an `Art` or a `PopIcon`. */
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function PopButton({
  label,
  onPress,
  tone = 'grass',
  size = 'md',
  disabled = false,
  icon,
  style,
  accessibilityLabel,
}: PopButtonProps) {
  const press = useSharedValue(0);
  const metrics = SIZE[size];

  // Chunky Pop translated the face into a hard sibling shadow. With a blurred
  // shadow there is nothing to translate into, so the press reads as the button
  // squashing down into the page.
  //
  // Only the transform is animated. `boxShadow` is not a Reanimated-animatable
  // prop, so it stays a static style rather than being driven off `press`.
  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.value * 0.04 }, { translateY: press.value * 2 }],
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
      style={[disabled && styles.disabled, style]}
    >
      <Animated.View
        style={[
          styles.face,
          {
            backgroundColor: TONE_FILL[tone],
            borderRadius: metrics.radius,
            paddingVertical: metrics.paddingVertical,
            paddingHorizontal: metrics.paddingHorizontal,
          },
          faceStyle,
        ]}
      >
        {icon}
        {/* `numberOfLines` with a shrinkable label, or the button loses letters.
            Buttons sit in fixed-width rows and inside clipping `PopSurface` faces,
            so a label that outgrows its face — a long word, a narrow phone, or the
            reader's font scale — was simply cut off mid-word. Shrinking degrades
            to an ellipsis instead, which is legible and obviously deliberate. */}
        <Text
          numberOfLines={1}
          style={[styles.label, { color: TONE_LABEL[tone], fontSize: metrics.fontSize }]}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  face: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    boxShadow: shadow.button,
  },
  // `flexShrink` so the label gives way before the row (or a clipping ancestor)
  // does; `textAlign` keeps it centred once it has narrowed. See the label above.
  label: { fontFamily: typography.heading.fontFamily, flexShrink: 1, textAlign: 'center' },
  disabled: { opacity: 0.45 },
});
