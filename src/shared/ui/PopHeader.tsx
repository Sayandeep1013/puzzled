import { type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radii, shadow, spacing, typography } from '@/shared/theme';

import { Art } from './Art';
import { Text } from './Text';

interface PopHeaderProps {
  title: string;
  right?: ReactNode;
  onBack?: () => void;
  /**
   * Headings sit in a deep tint of their screen. Pass `onFill` on the saturated
   * grounds (Results, Pack) where the default green would disappear.
   */
  titleColor?: string;
}

/** Shared top bar: an optional back button, a centred title, a right slot. */
export function PopHeader({
  title,
  right,
  onBack,
  titleColor = colors.headingGreen,
}: PopHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.side}>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={12}
            onPress={onBack}
            style={styles.backButton}
          >
            <Art name="back" size={26} />
          </Pressable>
        ) : null}
      </View>
      <Text style={[styles.title, { color: titleColor }]} numberOfLines={1}>
        {title}
      </Text>
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  side: { minWidth: 48, justifyContent: 'center' },
  right: { alignItems: 'flex-end' },
  // The back arrow art is a bare yellow chevron with no ground of its own, so
  // it needs a surface behind it to stay legible on the saturated screens.
  backButton: {
    width: 42,
    height: 42,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    boxShadow: shadow.card,
  },
  title: { ...typography.title, flex: 1, textAlign: 'center' },
});
