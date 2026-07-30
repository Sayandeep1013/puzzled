import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, shadow, spacing, typography } from '@/shared/theme';

/**
 * The "PUZZLE JOURNEY" logo.
 *
 * Built from text rather than art because the team has not delivered a wordmark
 * (see `assets/art-source/README.md`). Keeping it behind this component means
 * swapping in real art later touches one file, not the Home screen.
 *
 * Three things make it read as a logo rather than a heading, all of which the
 * mockup does and a plain `<Text>` cannot:
 *
 * 1. **An arch.** Each letter is rotated and lifted along a curve, so the word
 *    bows upward in the middle instead of sitting on a flat baseline.
 * 2. **A thick outline.** React Native has no text stroke, and a single
 *    `textShadow` is too thin to read as one. Each letter is therefore drawn
 *    twice: a white copy behind with a wide shadow radius acts as the outline,
 *    and the coloured copy sits on top carrying its own drop shadow.
 * 3. **A colour per letter**, from an explicit list rather than `accentRamp` —
 *    the logo wants a specific playful sequence, not the palette's list order.
 */
const TOP = 'PUZZLE';
const BOTTOM = 'JOURNEY';

/** One bright per letter of PUZZLE, chosen to alternate warm and cool. */
export const LETTER_COLORS = [
  colors.cherry,
  colors.apricot,
  colors.honey,
  colors.grass,
  colors.berry,
  colors.blossom,
];

/** Degrees the outermost letters tilt; the middle stays upright. */
const MAX_TILT = 13;
/** Points the outermost letters drop below the centre, forming the arch. */
const ARCH_DROP = 15;

export function WordmarkTitle({ scale = 1 }: { scale?: number }) {
  const letters = [...TOP];
  const lastIndex = letters.length - 1;
  const fontSize = 52 * scale;

  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityRole="header"
      accessibilityLabel="Puzzle Journey"
    >
      <View style={styles.row}>
        {letters.map((letter, index) => {
          // -1 at the left edge, 0 in the middle, +1 at the right edge.
          const t = lastIndex === 0 ? 0 : (index / lastIndex) * 2 - 1;
          const tilt = t * MAX_TILT;
          // Squared so the drop is gentle near the middle and steep at the ends.
          const drop = t * t * ARCH_DROP * scale;

          return (
            <View
              key={`${letter}-${index}`}
              testID={`wordmark-letter-${index}`}
              style={{
                transform: [{ translateY: drop }, { rotateZ: `${tilt}deg` }],
              }}
            >
              {/* Outline layer: white, blurred wide, sitting exactly behind. */}
              <Text style={[styles.letter, styles.outline, { fontSize }]}>{letter}</Text>
              <Text style={[styles.letter, { fontSize, color: LETTER_COLORS[index] }]}>
                {letter}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={[styles.badge, { marginTop: -6 * scale }]}>
        <Text style={[styles.badgeText, { fontSize: 24 * scale }]}>{BOTTOM}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  // `flex-end` so the arch's dropped outer letters hang below a shared top edge
  // rather than each letter centring on its own box.
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  letter: {
    fontFamily: typography.hero.fontFamily,
    letterSpacing: 0.5,
    // A warm drop shadow under the colour gives the letters weight.
    textShadowColor: 'rgba(58, 43, 26, 0.35)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 3,
  },
  outline: {
    position: 'absolute',
    color: colors.onFill,
    textShadowColor: colors.onFill,
    textShadowOffset: { width: 0, height: 0 },
    // Wide enough to read as a sticker outline once the coloured glyph covers
    // the middle. A single thin shadow is what made the old version look flat.
    textShadowRadius: 12,
  },
  badge: {
    paddingHorizontal: spacing.xl,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.sky,
    // The mockup rings its badge in white, which separates it from the sky.
    borderWidth: 3,
    borderColor: colors.onFill,
    boxShadow: shadow.raised,
    // A slight counter-tilt against the arch keeps the pair from looking rigid.
    transform: [{ rotateZ: '-2deg' }],
  },
  badgeText: {
    fontFamily: typography.hero.fontFamily,
    color: colors.onFill,
    letterSpacing: 4,
    textShadowColor: 'rgba(0, 73, 143, 0.45)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 2,
  },
});
