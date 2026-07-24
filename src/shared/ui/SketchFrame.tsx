import { type ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { colors, radii } from '@/shared/theme';

interface SketchFrameProps {
  children?: ReactNode;
  /** Fill behind the children. Omit for a transparent card. */
  fill?: string;
  /** Border colour. */
  stroke?: string;
  /** Border width. */
  strokeWidth?: number;
  radius?: number;
  /** Padding applied inside the frame around children. */
  padding?: number;
  style?: ViewStyle;
  /** Accepted for API parity with the hand-drawn theme; unused when flat. */
  jitter?: number;
  seed?: number;
}

/**
 * The app's card primitive: a flat rounded rectangle with a hairline border and
 * an optional fill. Same props as the hand-drawn `SketchFrame` so screens are
 * shared across themes; `jitter`/`seed` are ignored in this clean variant.
 */
export function SketchFrame({
  children,
  fill,
  stroke = colors.line,
  strokeWidth = 1.5,
  radius = radii.md,
  padding = 0,
  style,
}: SketchFrameProps) {
  return (
    <View
      style={[
        styles.frame,
        {
          backgroundColor: fill,
          borderColor: stroke,
          borderWidth: strokeWidth,
          borderRadius: radius,
        },
        style,
      ]}
    >
      <View style={{ padding }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
});
