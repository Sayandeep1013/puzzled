import LottieView from 'lottie-react-native';
import { type StyleProp, type ViewStyle } from 'react-native';

interface AnimatedArtProps {
  /** The numeric asset id from `require('./something.lottie')` or similar. */
  source: number;
  loop?: boolean;
  autoPlay?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Thin wrapper over lottie-react-native's `LottieView`. Screens must import
 * this, never `LottieView` directly, so the animation runtime can be swapped
 * (e.g. for Rive) later without touching call sites.
 */
export function AnimatedArt({ source, loop = true, autoPlay = true, style }: AnimatedArtProps) {
  return (
    <LottieView
      // lottie-react-native's TS types only list string/object/{uri} sources,
      // but its runtime (`parsePossibleSources`) explicitly handles a numeric
      // asset id via `Image.resolveAssetSource`, which is what `require(...)`
      // produces for a bundled animation file. The cast bridges that gap.
      source={source as unknown as string}
      loop={loop}
      autoPlay={autoPlay}
      style={style}
    />
  );
}
