import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radii, spacing, typography } from '@/shared/theme';
import { PopButton, PopIcon, PopSurface } from '@/shared/ui';

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

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.body}>
          <Text style={styles.title}>Well Done!</Text>

          <PopSurface fill={colors.honey} radius={30} style={styles.trophyFrame}>
            <View style={styles.trophyInner}>
              <PopIcon name="trophy" size={110} color={colors.ink} />
            </View>
          </PopSurface>

          {/* Mint is light enough for direct ink text — matches
              `home-screen.tsx`'s `progressCard` and `daily-screen.tsx`'s
              `streakFrame`, so no nested white body is needed here. */}
          <PopSurface fill={colors.grass} radius={radii.md} style={styles.banner}>
            <Text style={styles.bannerText}>You completed the puzzle!</Text>
          </PopSurface>

          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>TIME</Text>
              <Text style={styles.statValue}>{formatClock(time)}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statLabel}>PIECES</Text>
              <Text style={styles.statValue}>{pieces}</Text>
            </View>
            {coins > 0 ? (
              <>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>COINS</Text>
                  <Text style={styles.statValue}>+{coins}</Text>
                </View>
              </>
            ) : null}
          </View>
        </View>

        <View style={styles.footer}>
          <PopButton
            label="Play Again"
            tone="honey"
            onPress={() =>
              router.replace({
                pathname: '/game/[puzzleId]',
                params: { puzzleId, size: String(size) },
              })
            }
          />
          <PopButton label="Back Home" tone="grass" onPress={() => router.dismissAll()} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  safe: { flex: 1 },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
  },
  title: { ...typography.hero, color: colors.ink },
  trophyFrame: { width: 180 },
  trophyInner: { alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  banner: { alignSelf: 'center' },
  bannerText: {
    ...typography.bodyStrong,
    color: colors.ink,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    marginTop: spacing.sm,
  },
  stat: { alignItems: 'center', gap: 2 },
  statLabel: { ...typography.label, color: colors.inkMuted },
  statValue: { ...typography.title, fontSize: 34, color: colors.ink },
  statDivider: { width: 2, height: 44, backgroundColor: colors.ink },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.md },
});
