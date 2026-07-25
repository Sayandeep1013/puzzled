import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/shared/theme';

import { PopIcon } from './PopIcon';

interface PopHeaderProps {
  title: string;
  right?: ReactNode;
  onBack?: () => void;
}

/** Shared top bar: an optional back chevron, a centred title, a right slot. */
export function PopHeader({ title, right, onBack }: PopHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.side}>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={12}
            onPress={onBack}
          >
            <PopIcon name="back" />
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.title} numberOfLines={1}>
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
  title: { ...typography.title, flex: 1, textAlign: 'center', color: colors.ink },
});
