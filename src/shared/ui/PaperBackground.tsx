import { Canvas, Fill, Rect, Turbulence } from '@shopify/react-native-skia';
import { type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { colors } from '@/shared/theme';

/**
 * Full-bleed warm-paper backdrop: a solid canvas fill with a very faint Skia
 * noise grain layered on top so surfaces read as printed paper rather than a
 * flat digital rectangle. Children render above the texture.
 */
export function PaperBackground({ children }: { children: ReactNode }) {
  const { width, height } = useWindowDimensions();

  return (
    <View style={styles.root}>
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        <Fill color={colors.canvas} />
        <Rect x={0} y={0} width={width} height={height} opacity={0.05}>
          <Turbulence freqX={0.85} freqY={0.85} octaves={3} seed={7} />
        </Rect>
      </Canvas>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  content: { flex: 1 },
});
