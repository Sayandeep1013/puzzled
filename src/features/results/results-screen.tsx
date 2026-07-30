import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getPuzzleById, resolvePuzzleImageSource } from '@/data';
import { backgrounds, colors, radii, spacing, typography } from '@/shared/theme';
import { Art, PopButton, PopSurface } from '@/shared/ui';

function formatClock(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '—';
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function ResultsScreen({
  puzzleId,
  size,
  time,
  coins = 0,
}: {
  puzzleId: string;
  size: number;
  time: number;
  /** Coins credited for this completion (Task 14), shown when positive. */
  coins?: number;
}) {
  const router = useRouter();
  const pieces = size * size;
  /** The finished artwork, which the mockup makes the centrepiece of this screen. */
  const [image, setImage] = useState<number | string | null>(null);

  useEffect(() => {
    let active = true;
    getPuzzleById(puzzleId)
      .then((puzzle) => {
        if (active) setImage(puzzle ? resolvePuzzleImageSource(puzzle) : null);
      })
      .catch(() => {
        // Best-effort: the trophy fallback below still celebrates the win.
      });
    return () => {
      active = false;
    };
  }, [puzzleId]);

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.body}>
          {/* The mockup's celebration screen is the one saturated ground in the
              app, so every text colour here is white rather than ink. */}
          <Text style={styles.title}>Amazing!</Text>
          <Text style={styles.subtitle}>You completed the puzzle!</Text>

          {/* The mockup puts the finished picture here, not a generic trophy —
              the artwork you just assembled is the reward. The trophy remains as
              a fallback for a puzzle whose image cannot be resolved. */}
          {image != null ? (
            <PopSurface
              fill={colors.surface}
              radius={radii.lg}
              elevation="raised"
              contentStyle={styles.artFrame}
            >
              <Image
                source={typeof image === 'number' ? image : { uri: image }}
                style={styles.art}
                resizeMode="cover"
              />
            </PopSurface>
          ) : (
            <Art name="cup-star" size={150} />
          )}

          <View style={styles.stats}>
            <Stat label="TIME" value={formatClock(time)} />
            <View style={styles.statDivider} />
            <Stat label="PIECES" value={String(pieces)} />
            {coins > 0 ? (
              <>
                <View style={styles.statDivider} />
                <Stat label="COINS" value={`+${coins}`} art="coin" />
              </>
            ) : null}
          </View>

          <Art name="bear-excited" size={128} style={styles.mascot} />
        </View>

        <View style={styles.footer}>
          <PopButton
            label="Play Again"
            tone="honey"
            icon={<Art name="restart" size={24} />}
            onPress={() =>
              router.replace({
                pathname: '/game/[puzzleId]',
                params: { puzzleId, size: String(size) },
              })
            }
          />
          <PopButton
            label="Back Home"
            tone="grass"
            icon={<Art name="quit-home" size={24} />}
            onPress={() => router.dismissAll()}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

/** One figure in the results row. Cream card so the numerals keep ink contrast. */
function Stat({
  label,
  value,
  art,
}: {
  label: string;
  value: string;
  art?: 'coin' | 'star' | 'clock';
}) {
  return (
    <PopSurface fill={colors.surface} radius={radii.md} contentStyle={styles.statInner}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statValueRow}>
        {art ? <Art name={art} size={20} /> : null}
        <Text style={styles.statValue}>{value}</Text>
      </View>
    </PopSurface>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: backgrounds.results },
  safe: { flex: 1 },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  artFrame: { padding: spacing.sm },
  art: { width: 236, height: 236, borderRadius: radii.md },
  title: { ...typography.hero, color: colors.honey },
  subtitle: { ...typography.heading, color: colors.onFill, textAlign: 'center' },
  mascot: { marginTop: spacing.xs },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  statInner: { alignItems: 'center', gap: 2, paddingHorizontal: spacing.md, paddingVertical: 10 },
  statLabel: { ...typography.label, fontSize: 11, color: colors.inkMuted },
  statValueRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statValue: { ...typography.title, fontSize: 26, color: colors.ink },
  statDivider: { width: 6 },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.md },
});
