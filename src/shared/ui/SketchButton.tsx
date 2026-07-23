import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { colors, radii, spacing, typography } from '@/shared/theme';
import { SketchFrame } from './SketchFrame';
import { seedFromString } from './sketch';

type Variant = 'primary' | 'gold' | 'plain';

const FILLS: Record<Variant, string> = {
  primary: colors.primary,
  gold: colors.gold,
  plain: colors.surface,
};

const PRESSED: Record<Variant, string> = {
  primary: colors.primaryPressed,
  gold: colors.goldPressed,
  plain: colors.kraft,
};

const TEXT: Record<Variant, string> = {
  primary: colors.surfaceStrong,
  gold: colors.inkSoft,
  plain: colors.inkSoft,
};

interface SketchButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

/** A hand-drawn button: a filled {@link SketchFrame} with a handwritten label. */
export function SketchButton({
  label,
  onPress,
  variant = 'primary',
  disabled,
  style,
  accessibilityLabel,
}: SketchButtonProps) {
  const seed = seedFromString(label);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled}
      onPress={onPress}
      style={[style, disabled && styles.disabled]}
    >
      {({ pressed }) => (
        <SketchFrame
          fill={pressed ? PRESSED[variant] : FILLS[variant]}
          stroke={colors.sketch}
          strokeWidth={2.2}
          radius={radii.md}
          seed={seed}
          padding={0}
        >
          <View style={styles.inner}>
            <Text style={[styles.label, { color: TEXT[variant] }]}>{label}</Text>
          </View>
        </SketchFrame>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  inner: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...typography.heading,
    fontSize: 20,
  },
  disabled: { opacity: 0.5 },
});
