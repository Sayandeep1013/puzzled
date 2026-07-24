import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { colors, radii, spacing, typography } from '@/shared/theme';

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

/** The app's primary button: a flat filled pill-rounded rectangle with a label. */
export function SketchButton({
  label,
  onPress,
  variant = 'primary',
  disabled,
  style,
  accessibilityLabel,
}: SketchButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled}
      onPress={onPress}
      style={[style, disabled && styles.disabled]}
    >
      {({ pressed }) => (
        <View
          style={[
            styles.button,
            {
              backgroundColor: pressed ? PRESSED[variant] : FILLS[variant],
              borderColor: variant === 'plain' ? colors.line : 'transparent',
            },
          ]}
        >
          <Text style={[styles.label, { color: TEXT[variant] }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    borderWidth: 1.5,
  },
  label: {
    ...typography.heading,
    fontSize: 18,
  },
  disabled: { opacity: 0.5 },
});
