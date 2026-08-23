import { Pressable, StyleSheet } from 'react-native';

import { colors, radii, spacing, typography } from '@/shared/theme';

import { Art } from './Art';
import { PopSurface } from './PopSurface';
import { type PopIconName, PopIcon } from './PopIcon';
import { Text } from './Text';
import { type ArtName } from '@/shared/art';

interface PopChipProps {
  label: string;
  /** Prefer `art` — the real asset set. `icon` is the Phosphor fallback. */
  art?: ArtName;
  icon?: PopIconName;
  selected?: boolean;
  /** A hex/rgb colour, not a token name — callers reach for `colors.*`. */
  tone?: string;
  onPress?: () => void;
}

/** A small pill filter/tag. Selected chips fill solid with `tone`. */
export function PopChip({
  label,
  art,
  icon,
  selected = false,
  tone = colors.grass,
  onPress,
}: PopChipProps) {
  // Chip labels are 13pt, so they need WCAG AA *body* contrast (4.5:1), not the
  // 3.0:1 a button's 18pt label gets. Against this palette's brights, ink
  // clears that comfortably (grass 6.16, apricot 6.45, blossom 6.11) while
  // white does not clear even 3.0 — so ink wins whether or not the chip is
  // selected. Do not pass `berry` or `cherry` as a chip tone: ink lands at
  // ~3.7 on those, fine for a button but short of the body threshold.
  const contentColor = colors.ink;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
    >
      <PopSurface
        radius={radii.pill}
        elevation={selected ? 'card' : 'pressed'}
        fill={selected ? tone : colors.surface}
        contentStyle={styles.content}
      >
        {art ? <Art name={art} size={18} /> : null}
        {!art && icon ? <PopIcon name={icon} size={16} color={contentColor} /> : null}
        {/* Single line, shrinkable: `PopSurface`'s face clips, so a chip label
            that outgrows it loses its end rather than wrapping. */}
        <Text numberOfLines={1} style={[styles.label, { color: contentColor }]}>
          {label}
        </Text>
      </PopSurface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  // See `PopButton`'s label: two points of measurement slack, not spacing.
  label: { ...typography.caption, flexShrink: 1, paddingHorizontal: 2 },
});
