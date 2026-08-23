import { type ReactNode } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { radii, shadow, spacing, springs, typography } from '@/shared/theme';
import { useTheme } from '@/shared/theme-context';
import { type Theme } from '@/shared/themes';

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
export function toneFill(theme: Theme): Record<PopTone, string> {
  return {
    grass: theme.colors.grassDeep,
    leaf: theme.colors.leaf,
    sky: theme.colors.skyDeep,
    berry: theme.colors.berry,
    blossom: theme.colors.blossom,
    honey: theme.colors.honey,
    apricot: theme.colors.apricot,
    cherry: theme.colors.cherry,
    surface: theme.colors.surface,
  };
}

export function toneLabel(theme: Theme): Record<PopTone, string> {
  return {
    grass: theme.colors.onFill, // 3.25 on the meadow
    leaf: theme.colors.ink, // 6.63
    sky: theme.colors.onFill, // 3.21
    berry: theme.colors.onFill, // 3.60
    blossom: theme.colors.ink, // 6.11
    honey: theme.colors.ink, // 10.08
    apricot: theme.colors.ink, // 6.45
    cherry: theme.colors.onFill, // 3.64
    surface: theme.colors.ink, // 12.47
  };
}

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
  const theme = useTheme();
  const press = useSharedValue(0);
  const metrics = SIZE[size];
  const fill = toneFill(theme)[tone];
  const labelColor = toneLabel(theme)[tone];

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
            backgroundColor: fill,
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
          style={[styles.label, { color: labelColor, fontSize: metrics.fontSize }]}
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
  label: {
    fontFamily: typography.heading.fontFamily,
    flexShrink: 1,
    textAlign: 'center',
    // Two points of horizontal slack, which is measurement headroom, not spacing.
    // Android measures a `Text`'s intrinsic width and draws its glyphs with
    // slightly different rounding, and an OS font scale makes `fontSize`
    // fractional (14 x 0.85 = 11.9) which widens the gap. When the drawn string
    // needs marginally more than the measured box, `numberOfLines={1}` ellipsises
    // a label that had hundreds of points of room beside it — measured on device:
    // "My Album" truncated to "My Alb..." inside a card 356px wide.
    paddingHorizontal: 2,
  },
  disabled: { opacity: 0.45 },
});
