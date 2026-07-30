import { StyleSheet, Text, View } from 'react-native';

import { accentAt, colors, radii, shadow, spacing, typography } from '@/shared/theme';

/**
 * The "PUZZLE JOURNEY" logo: each letter of PUZZLE in its own bright, JOURNEY in
 * white on a sky pill.
 *
 * Built from text rather than art because the team has not delivered a wordmark
 * (see `assets/art-source/README.md`). Keeping it behind this component means
 * swapping in real art later touches one file, not the Home screen.
 *
 * The white outline is a `textShadow` with zero offset and a small radius, which
 * reads as a halo on both the sky and the grass the logo can sit against.
 */
const TOP = 'PUZZLE';
const BOTTOM = 'JOURNEY';

export function WordmarkTitle({ scale = 1 }: { scale?: number }) {
  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityRole="header"
      accessibilityLabel="Puzzle Journey"
    >
      <View style={styles.row}>
        {[...TOP].map((letter, index) => (
          <Text
            key={`${letter}-${index}`}
            style={[
              styles.letter,
              {
                color: accentAt(index),
                fontSize: 46 * scale,
                lineHeight: 54 * scale,
              },
            ]}
          >
            {letter}
          </Text>
        ))}
      </View>

      <View style={styles.badge}>
        <Text style={[styles.badgeText, { fontSize: 22 * scale }]}>{BOTTOM}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: -2 },
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  letter: {
    fontFamily: typography.hero.fontFamily,
    letterSpacing: 1,
    // A halo rather than a directional shadow: the logo sits on sky at the top of
    // Home but can meet grass on a short screen, and a halo works on both.
    textShadowColor: colors.onFill,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  badge: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.sky,
    boxShadow: shadow.card,
  },
  badgeText: {
    fontFamily: typography.hero.fontFamily,
    color: colors.onFill,
    letterSpacing: 3,
  },
});
