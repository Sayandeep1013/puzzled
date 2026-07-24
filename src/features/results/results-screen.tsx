import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radii, spacing, typography } from '@/shared/theme';
import { PaperBackground, SketchButton, SketchFrame, SketchIcon } from '@/shared/ui';

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
}: {
  puzzleId: string;
  size: number;
  time: number;
}) {
  const router = useRouter();
  const pieces = size * size;

  return (
    <PaperBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.body}>
          <Text style={styles.title}>Well Done!</Text>

          <SketchFrame fill={colors.gold} radius={30} seed={88} style={styles.trophyFrame}>
            <View style={styles.trophyInner}>
              <SketchIcon name="trophy" size={110} color={colors.inkSoft} strokeWidth={2.4} />
            </View>
          </SketchFrame>

          <SketchFrame fill={colors.sage} radius={radii.md} seed={12} style={styles.banner}>
            <Text style={styles.bannerText}>You completed the puzzle!</Text>
          </SketchFrame>

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
          </View>
        </View>

        <View style={styles.footer}>
          <SketchButton
            label="Play Again"
            variant="gold"
            onPress={() =>
              router.replace({
                pathname: '/game/[puzzleId]',
                params: { puzzleId, size: String(size) },
              })
            }
          />
          <SketchButton
            label="Back Home"
            variant="primary"
            onPress={() => router.dismissAll()}
          />
        </View>
      </SafeAreaView>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.lg },
  title: { ...typography.hero, color: colors.ink },
  trophyFrame: { width: 180 },
  trophyInner: { alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  banner: { alignSelf: 'center' },
  bannerText: {
    ...typography.bodyStrong,
    color: colors.inkSoft,
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
  statDivider: { width: 2, height: 44, backgroundColor: colors.line },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.md },
});
