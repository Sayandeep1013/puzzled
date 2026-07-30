import { Image, type ImageStyle, type StyleProp } from 'react-native';

import { getArtModule, type ArtName } from '@/shared/art';

interface ArtProps {
  name: ArtName;
  /** Square box in points. The art is letterboxed inside it, never cropped. */
  size?: number;
  style?: StyleProp<ImageStyle>;
  /**
   * Art is decorative by default — the surrounding Pressable or Text already
   * carries the label, and announcing "coin" twice is worse than not at all.
   * Pass a label only when the art is the sole carrier of meaning.
   */
  accessibilityLabel?: string;
  testID?: string;
}

/**
 * Draws one asset from the Puzzle Journey art set.
 *
 * `contain` rather than `cover`: the source PNGs are square with transparent
 * padding, so cover would crop the drop shadows the artist baked in.
 */
export function Art({ name, size = 32, style, accessibilityLabel, testID }: ArtProps) {
  const labelled = accessibilityLabel != null;

  return (
    <Image
      source={getArtModule(name)}
      style={[{ width: size, height: size }, style]}
      resizeMode="contain"
      accessible={labelled}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={labelled ? 'image' : 'none'}
      testID={testID}
    />
  );
}
