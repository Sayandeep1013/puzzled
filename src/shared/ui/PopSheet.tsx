import { type ReactNode, useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { radii, spacing, springs, typography } from '@/shared/theme';
import { createThemedStyles } from '@/shared/themed-styles';

import { PopSurface } from './PopSurface';
import { Text } from './Text';

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
  const styles = useStyles();
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
        <Animated.View style={[styles.card, cardStyle]}>
          <PopSurface
            radius={radii.xl}
            elevation="raised"
            style={styles.sheet}
            contentStyle={styles.content}
          >
            {title ? <Text style={styles.title}>{title}</Text> : null}
            {children}
          </PopSurface>
        </Animated.View>
      </View>
    </View>
  );
}

const useStyles = createThemedStyles((theme) =>
  StyleSheet.create({
    // Warm brown scrim rather than neutral black — a grey veil over this palette
    // reads as the screen having gone flat.
    scrim: { backgroundColor: 'rgba(58, 43, 26, 0.5)' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
    // The width constraint belongs on the animated wrapper and the surface box,
    // not on the inner face: `width: '100%'` on the face would resolve against a
    // wrapper that is itself sizing to its content.
    card: { width: '100%', maxWidth: 360 },
    sheet: { width: '100%' },
    content: { padding: spacing.lg },
    title: {
      ...typography.title,
      color: theme.colors.headingGreen,
      textAlign: 'center',
      marginBottom: spacing.md,
    },
  }),
);
