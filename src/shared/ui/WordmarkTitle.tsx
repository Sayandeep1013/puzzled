import { Image, StyleSheet, View } from 'react-native';

import { getArtModule } from '@/shared/art';

/**
 * The "PUZZLE JOURNEY" logo.
 *
 * Real art now. This was built letter by letter from `<Text>` — seven coloured
 * nodes, each drawn twice to fake an outline React Native cannot stroke, arched
 * by per-letter rotation — because the team had not delivered a wordmark. They
 * have (`puzzle assets/new mockup and assets.svg`), so the reconstruction goes.
 *
 * That is not just tidier, it removes a whole class of bug. The text version
 * scaled with the reader's font setting, so the lockup grew past the screen
 * width at large accessibility sizes; its letters were laid out by a formula
 * that had to be kept in sync with the word; and the "cream border" the mockup
 * shows was approximated with a wide white `textShadow`, which is a blur, not a
 * border. An image has none of those problems and matches the mockup exactly.
 *
 * The aspect ratio is baked from the trimmed asset (1317x607) so the lockup
 * reserves the right height before the image decodes — without it the content
 * below jumps once the art loads.
 */

/** Width of the lockup at `scale` 1, in points. */
const BASE_WIDTH = 300;
/** From the trimmed source art; keep in step if the asset is re-exported. */
const ASPECT = 1317 / 607;

interface WordmarkTitleProps {
  /** Multiplier on the lockup's width. The height follows the aspect ratio. */
  scale?: number;
}

export function WordmarkTitle({ scale = 1 }: WordmarkTitleProps) {
  const width = BASE_WIDTH * scale;

  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityRole="header"
      accessibilityLabel="Puzzle Journey"
      testID="wordmark"
    >
      <Image
        source={getArtModule('wordmark')}
        style={{ width, height: width / ASPECT }}
        // `contain`, so the lockup is never cropped or stretched at any scale.
        resizeMode="contain"
        // The View above carries the label; the image itself is decorative, or
        // screen readers announce the logo twice.
        accessible={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  /**
   * The lockup sits directly on whatever is behind it — no panel.
   *
   * It used to carry a translucent white rounded panel, on the theory that the
   * letters needed something holding them together over a photographic
   * background. On the meadow it read as a frosted box pasted over the art. The
   * art carries its own cream border, which is what actually separates it from
   * any ground.
   */
  wrap: { alignItems: 'center' },
});
