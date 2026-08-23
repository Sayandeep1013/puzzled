import { Image, StyleSheet, View } from 'react-native';

import { useTheme } from '@/shared/theme-context';

/**
 * The active theme's material, filling whatever it is placed in.
 *
 * Rendered as the first child of a screen's root so every other child paints
 * over it. Absolutely positioned and non-interactive, so it changes nothing
 * about layout or touch handling — a screen that adds it looks identical under
 * a theme with no texture.
 *
 * `cover` rather than `repeat`: the source is a single sheet rather than a
 * proven-seamless tile, and a visible seam every few hundred points is worse
 * than a slightly enlarged grain. The art is stored upright for the same
 * reason — covering a landscape sheet onto a tall screen scales it about three
 * times over and the grain turns to blur.
 */
export function ThemeGround() {
  const theme = useTheme();

  if (theme.groundTexture == null) {
    return null;
  }

  return (
    // Wrapped, because `pointerEvents` is a View prop: RN 0.86's `Image` accepts
    // it neither as a prop nor in its style, and the ground must never take a
    // touch meant for what is drawn on top of it.
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image
        source={theme.groundTexture}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        accessible={false}
      />
    </View>
  );
}
