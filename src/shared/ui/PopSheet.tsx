import { type ReactNode, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { colors, radii, shadow, spacing, springs, typography } from '@/shared/theme';

import { PopSurface } from './PopSurface';

interface PopSheetProps {
  children: ReactNode;
  onDismiss: () => void;
  title?: string;
}

/**
 * A modal-style card over a dark scrim. Rendered conditionally by the caller
 * (`{visible && <PopSheet ...>}`) rather than managing its own visibility.
 */
export function PopSheet({ children, onDismiss, title }: PopSheetProps) {
  const scale = useSharedValue(0.9);

  useEffect(() => {
    scale.value = withSpring(1, springs.pop);
  }, [scale]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        style={[StyleSheet.absoluteFill, styles.scrim]}
        onPress={onDismiss}
      />
      <View style={styles.center} pointerEvents="box-none">
        <Animated.View style={cardStyle}>
          <PopSurface radius={radii.lg} offset={shadow.hero} contentStyle={styles.content}>
            {title ? <Text style={styles.title}>{title}</Text> : null}
            {children}
          </PopSurface>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: 'rgba(20,20,20,0.55)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  content: { padding: spacing.lg, maxWidth: 360, width: '100%' },
  title: { ...typography.title, color: colors.ink, textAlign: 'center', marginBottom: spacing.md },
});
