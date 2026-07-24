import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listCatalog, resolvePuzzleImageSource } from '@/data';
import { type PuzzleDefinition } from '@/game-engine';
import { colors, radii, spacing, typography } from '@/shared/theme';
import { PaperBackground, ScreenHeader, SketchButton, SketchFrame, SketchIcon } from '@/shared/ui';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function DailyScreen() {
  const router = useRouter();
  const [featured, setFeatured] = useState<PuzzleDefinition | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      listCatalog().then(({ bundled, user }) => {
        if (active) setFeatured(bundled[0] ?? user[0] ?? null);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const calendar = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const today = now.getDate();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
    for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);
    return { label: `${MONTHS[month]} ${year}`, cells, today };
  }, []);

  const source = featured ? resolvePuzzleImageSource(featured) : null;

  return (
    <PaperBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScreenHeader title="Daily Puzzle" />
        <View style={styles.content}>
          <SketchFrame fill={colors.surface} radius={radii.lg} seed={17}>
            <View style={styles.calendar}>
              <Text style={styles.month}>{calendar.label}</Text>
              <View style={styles.weekRow}>
                {WEEKDAYS.map((w, i) => (
                  <Text key={i} style={styles.weekday}>
                    {w}
                  </Text>
                ))}
              </View>
              <View style={styles.daysGrid}>
                {calendar.cells.map((day, i) => {
                  const isToday = day === calendar.today;
                  return (
                    <View key={i} style={styles.dayCell}>
                      {day != null ? (
                        isToday ? (
                          <View style={styles.todayDot}>
                            <Text style={styles.todayText}>{day}</Text>
                          </View>
                        ) : (
                          <Text style={styles.dayText}>{day}</Text>
                        )
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </View>
          </SketchFrame>

          <View style={styles.tapedWrap}>
            <View style={[styles.tape, styles.tapeLeft]} />
            <View style={[styles.tape, styles.tapeRight]} />
            <SketchFrame fill={colors.kraft} radius={radii.md} seed={23}>
              <View style={styles.featureImageWrap}>
                {source != null ? (
                  <Image
                    source={typeof source === 'number' ? source : { uri: source }}
                    style={styles.featureImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.featureFallback}>
                    <SketchIcon name="calendar" size={48} color={colors.inkMuted} />
                  </View>
                )}
              </View>
            </SketchFrame>
          </View>

          <Text style={styles.prompt}>Complete today&apos;s puzzle, win a reward!</Text>

          <SketchButton
            label="Play Now"
            variant="primary"
            disabled={!featured}
            onPress={() =>
              featured &&
              router.push({ pathname: '/difficulty/[puzzleId]', params: { puzzleId: featured.id } })
            }
          />
        </View>
      </SafeAreaView>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  calendar: { padding: spacing.md, gap: spacing.sm },
  month: { ...typography.heading, color: colors.ink, textAlign: 'center' },
  weekRow: { flexDirection: 'row' },
  weekday: { ...typography.label, fontSize: 11, color: colors.inkMuted, flex: 1, textAlign: 'center' },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayText: { ...typography.body, color: colors.ink },
  todayDot: {
    width: 34,
    height: 34,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayText: { ...typography.bodyStrong, color: colors.surfaceStrong },
  tapedWrap: { alignItems: 'center' },
  tape: {
    position: 'absolute',
    top: -8,
    width: 54,
    height: 22,
    backgroundColor: 'rgba(231,185,90,0.55)',
    borderWidth: 1,
    borderColor: colors.line,
    zIndex: 2,
  },
  tapeLeft: { left: 24, transform: [{ rotate: '-8deg' }] },
  tapeRight: { right: 24, transform: [{ rotate: '7deg' }] },
  featureImageWrap: {
    height: 180,
    borderRadius: radii.md,
    overflow: 'hidden',
    margin: spacing.xs,
  },
  featureImage: { width: '100%', height: '100%' },
  featureFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  prompt: { ...typography.heading, fontSize: 18, color: colors.ink, textAlign: 'center' },
});
