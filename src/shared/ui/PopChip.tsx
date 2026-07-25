import { Pressable, StyleSheet, Text } from 'react-native';

import { border, colors, radii, shadow, spacing, typography } from '@/shared/theme';

import { PopIcon, type PopIconName } from './PopIcon';
import { PopSurface } from './PopSurface';

interface PopChipProps {
  label: string;
  icon?: PopIconName;
  selected?: boolean;
  /** A hex/rgb colour, not a token name — callers reach for `colors.*`. */
  tone?: string;
  onPress?: () => void;
}

/** A small pill filter/tag. Selected chips fill solid with `tone`. */
export function PopChip({ label, icon, selected = false, tone = colors.grape, onPress }: PopChipProps) {
  // Most tones in the palette are dark/saturated enough that ink text fails
  // contrast on them once filled, so selected chips flip to onFill instead.
  const contentColor = selected ? colors.onFill : colors.ink;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
    >
      <PopSurface
        radius={radii.pill}
        offset={shadow.pressed}
        borderWidth={border.thin}
        fill={selected ? tone : colors.surface}
        contentStyle={styles.content}
      >
        {icon ? <PopIcon name={icon} size={16} color={contentColor} /> : null}
        <Text style={[styles.label, { color: contentColor }]}>{label}</Text>
      </PopSurface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  label: { ...typography.caption },
});
