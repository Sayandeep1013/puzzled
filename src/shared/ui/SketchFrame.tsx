import { Canvas, Path } from '@shopify/react-native-skia';
import { useMemo, useState, type ReactNode } from 'react';
import { LayoutChangeEvent, StyleSheet, View, type ViewStyle } from 'react-native';

import { colors, radii } from '@/shared/theme';
import { roughRoundedRectPath } from './sketch';

interface SketchFrameProps {
  children?: ReactNode;
  /** Fill drawn inside the wobbly outline. Omit for a transparent frame. */
  fill?: string;
  /** Stroke colour of the hand-drawn border. */
  stroke?: string;
  strokeWidth?: number;
  radius?: number;
  /** Amount of hand-drawn wobble, in px. */
  jitter?: number;
  /** Stable seed so the wobble does not shimmer across re-renders. */
  seed?: number;
  /** Padding applied inside the frame around children. */
  padding?: number;
  style?: ViewStyle;
}

// Extra room around the content box so the jittered stroke is never clipped.
const BLEED = 6;

/**
 * A container whose border is a seeded, hand-drawn rounded rectangle rendered
 * with Skia. Two overlapping strokes give the doubled marker look from the
 * mockup. The outline is drawn on an absolutely-positioned canvas behind the
 * children, so it composes with normal React Native layout.
 */
export function SketchFrame({
  children,
  fill,
  stroke = colors.sketch,
  strokeWidth = 2,
  radius = radii.md,
  jitter = 1.8,
  seed = 1,
  padding = 0,
  style,
}: SketchFrameProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.width || height !== size.height) {
      setSize({ width, height });
    }
  };

  const paths = useMemo(() => {
    if (size.width < 2 || size.height < 2) {
      return null;
    }
    return {
      a: roughRoundedRectPath(size.width, size.height, radius, seed, jitter),
      // Second pass, different seed, tighter jitter — the sketchy doubled edge.
      b: roughRoundedRectPath(size.width, size.height, radius, seed * 2 + 17, jitter * 0.7),
    };
  }, [size.width, size.height, radius, seed, jitter]);

  return (
    <View style={style} onLayout={onLayout}>
      {paths ? (
        <Canvas
          style={[
            StyleSheet.absoluteFill,
            { left: -BLEED, top: -BLEED, right: -BLEED, bottom: -BLEED },
          ]}
          pointerEvents="none"
        >
          {fill ? (
            <Path
              path={paths.a}
              color={fill}
              transform={[{ translateX: BLEED }, { translateY: BLEED }]}
            />
          ) : null}
          <Path
            path={paths.a}
            style="stroke"
            color={stroke}
            strokeWidth={strokeWidth}
            strokeJoin="round"
            strokeCap="round"
            transform={[{ translateX: BLEED }, { translateY: BLEED }]}
          />
          <Path
            path={paths.b}
            style="stroke"
            color={stroke}
            strokeWidth={strokeWidth * 0.8}
            opacity={0.55}
            strokeJoin="round"
            strokeCap="round"
            transform={[{ translateX: BLEED }, { translateY: BLEED }]}
          />
        </Canvas>
      ) : null}
      <View style={{ padding }}>{children}</View>
    </View>
  );
}
