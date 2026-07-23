import { useRouter } from 'expo-router';
import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/shared/theme';
import { SketchIcon } from './SketchIcon';

/**
 * Shared top bar for pushed screens: an optional back chevron, a centered
 * handwritten title, and an optional right-hand slot (e.g. a coin balance).
 */
export function ScreenHeader({
  title,
  onBack,
  showBack = true,
  right,
}: {
  title: string;
  onBack?: () => void;
  showBack?: boolean;
  right?: ReactNode;
}) {
  const router = useRouter();

  return (
    <View style={styles.header}>
      <View style={styles.side}>
        {showBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={12}
            onPress={onBack ?? (() => router.back())}
          >
            <SketchIcon name="back" size={26} color={colors.ink} />
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
