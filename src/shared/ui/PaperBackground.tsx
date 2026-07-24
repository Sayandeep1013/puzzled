import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/shared/theme';

/**
 * Full-bleed warm-canvas backdrop. Flat and cheap — a solid cream fill that the
 * screen content renders above. (The hand-drawn theme swaps in a textured
 * variant; this one keeps the clean look used on `main`.)
 */
export function PaperBackground({ children }: { children: ReactNode }) {
  return <View style={styles.root}>{children}</View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
});
