import { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { border, colors, radii, shadow } from '@/shared/theme';

interface PopSurfaceProps {
  children?: ReactNode;
  /** Face colour. */
  fill?: string;
  radius?: number;
  /** Hard shadow distance in points. Blur is always zero. */
  offset?: number;
  borderWidth?: number;
  /** Style for the outer wrapper — use for margins, width, flex. */
  style?: StyleProp<ViewStyle>;
  /** Style for the face — use for padding, alignment. */
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * The Chunky Pop card primitive: an ink-outlined face sitting on a hard,
 * unblurred ink shadow.
 *
 * The shadow is a sibling view rather than a platform shadow because Android's
 * `elevation` always blurs and iOS's `shadowRadius: 0` has no Android
 * equivalent. The wrapper pads right and bottom by `offset` so the shadow is
 * inside this component's layout box and never overlaps a sibling.
 */
export function PopSurface({
  children,
  fill = colors.surface,
  radius = radii.md,
  offset = shadow.default,
  borderWidth = border.standard,
  style,
  contentStyle,
  testID,
}: PopSurfaceProps) {
  return (
    <View testID={testID} style={[{ paddingRight: offset, paddingBottom: offset }, style]}>
      <View
        testID={testID ? `${testID}-shadow` : undefined}
        pointerEvents="none"
        style={[styles.shade, { left: offset, top: offset, borderRadius: radius }]}
      />
      <View
        testID={testID ? `${testID}-face` : undefined}
        style={[
          styles.face,
          { backgroundColor: fill, borderRadius: radius, borderWidth },
          contentStyle,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shade: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: colors.ink,
  },
  face: {
    borderColor: colors.ink,
    overflow: 'hidden',
  },
});
