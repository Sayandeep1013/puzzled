import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  dateKey,
  getProgressRepository,
  listCatalog,
  pickDailyPuzzle,
  resolvePuzzleImageSource,
  streakFrom,
} from '@/data';
import { type PuzzleDefinition } from '@/game-engine';
import { colors, radii, spacing, typography } from '@/shared/theme';
import { PopButton, PopHeader, PopIcon, PopSurface } from '@/shared/ui';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface DailyData {
  /** Today's pick, deterministic from `pickDailyPuzzle` — never `bundled[0]`. */
  puzzle: PuzzleDefinition | null;
  /**
   * Whether TODAY's daily puzzle already has a completed saved session.
   * This is the only real signal available (no daily-completion history
   * table exists yet — see `streak` below for how it is used honestly).
   */
  playedToday: boolean;
}

const EMPTY: DailyData = { puzzle: null, playedToday: false };

/**
 * Loads today's puzzle and checks whether it has genuinely been completed
 * today. `key` is `dateKey(new Date())` computed once by the caller (a UI
 * concern) — this function itself never touches the clock.
 */
async function loadDailyData(key: string): Promise<DailyData> {
  const { bundled, user } = await listCatalog();
  const pool = [...bundled, ...user];
  const puzzle = pickDailyPuzzle(pool, key);
  if (!puzzle) {
    return { puzzle: null, playedToday: false };
  }

  let playedToday = false;
  try {
    const rows = await (await getProgressRepository()).listSummaries();
    playedToday = rows.some(
      (row) =>
        row.puzzleId === puzzle.id &&
        row.status === 'completed' &&
        dateKey(new Date(row.updatedAt)) === key,
    );
  } catch {
    // Progress is best-effort; an unreadable database still shows today's
    // puzzle, it just cannot confirm a completion to build a streak on.
  }

  return { puzzle, playedToday };
}

export function DailyScreen() {
  const router = useRouter();
  const [data, setData] = useState<DailyData>(EMPTY);

  // Computed once at mount — a UI-layer "now", not something the pure daily
  // helpers (`dateKey`/`pickDailyPuzzle`/`streakFrom`) ever read themselves.
  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => dateKey(today), [today]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadDailyData(todayKey).then((next) => {
        if (active) setData(next);
      });
      return () => {
        active = false;
      };
    }, [todayKey]),
  );

  const calendar = useMemo(() => {
    const year = today.getFullYear();
    const month = today.getMonth();
    const day = today.getDate();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
    for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);
    return { label: `${MONTHS[month]} ${year}`, cells, today: day };
  }, [today]);

  /**
   * There is no daily-results history store yet (Phase 3), so this cannot
   * be a real historical streak. The only fact this screen actually knows
   * is whether TODAY's daily puzzle has a completed session, so that single
   * real data point — never invented history — is what `streakFrom` runs
   * on. The result is honestly always 0 or 1: 1 on the day you finish
   * today's puzzle, 0 every other day (including "played yesterday but not
   * today", since there is nothing behind that claim yet).
   */
  const streak = streakFrom(data.playedToday ? [todayKey] : [], todayKey);

  const source = data.puzzle ? resolvePuzzleImageSource(data.puzzle) : null;

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <PopHeader title="Daily Puzzle" onBack={() => router.back()} />
        <View style={styles.content}>
          <PopSurface fill={colors.surface} radius={radii.lg}>
            <View style={styles.calendar}>
              <Text style={styles.month}>{calendar.label}</Text>
              <View style={styles.weekRow}>
                {WEEKDAYS.map((weekday, i) => (
                  <Text key={i} style={styles.weekday}>
                    {weekday}
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
                          <View style={[styles.todayDot, data.playedToday && styles.todayDotPlayed]}>
                            {data.playedToday ? (
                              <PopIcon name="check" size={16} color={colors.ink} />
                            ) : (
                              <Text style={styles.todayText}>{day}</Text>
                            )}
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
          </PopSurface>

          {/* Sunshine is light enough for direct ink text — no white-body frame
              needed here, matching `home-screen.tsx`'s `progressCard` (mint). */}
          <PopSurface fill={colors.sunshine} radius={radii.lg} contentStyle={styles.streakFrame}>
            <View style={styles.streakBody}>
              <View style={styles.streakIconWrap}>
                <PopIcon name="streak" size={26} color={colors.tangerine} />
              </View>
              <View style={styles.streakCopy}>
                <Text style={styles.streakValue}>
                  {streak > 0 ? `${streak} day${streak === 1 ? '' : 's'} streak` : 'Start your streak today'}
                </Text>
                <Text style={styles.streakHint}>
                  {streak > 0
                    ? 'Nice! Come back tomorrow to keep it going.'
                    : "Finish today's puzzle to begin one."}
                </Text>
              </View>
            </View>
          </PopSurface>

          <PopSurface fill={colors.tangerine} radius={radii.lg} contentStyle={styles.featureFrame}>
            <View style={styles.featureBody}>
              {source != null ? (
                <Image
                  source={typeof source === 'number' ? source : { uri: source }}
                  style={styles.featureImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.featureFallback}>
                  <PopIcon name="calendar" size={48} color={colors.inkMuted} />
                </View>
              )}
            </View>
          </PopSurface>

          <Text style={styles.prompt}>
            {data.puzzle
              ? `Today's pick: ${data.puzzle.title}`
              : 'Add a puzzle from Home to unlock the daily pick.'}
          </Text>

          <PopButton
            label={data.playedToday ? 'Play again' : 'Play Now'}
            tone="grape"
            disabled={!data.puzzle}
            onPress={() => {
              if (data.puzzle) {
                router.push({
                  pathname: '/difficulty/[puzzleId]',
                  params: { puzzleId: data.puzzle.id },
                });
              }
            }}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
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
    backgroundColor: colors.grape,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayDotPlayed: { backgroundColor: colors.mint },
  todayText: { ...typography.bodyStrong, color: colors.onFill },
  streakFrame: { padding: spacing.lg },
  streakBody: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  streakIconWrap: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakCopy: { flex: 1, gap: 2 },
  streakValue: { ...typography.heading, fontSize: 18, color: colors.ink },
  streakHint: { ...typography.caption, color: colors.ink },
  // Inset padding on the coloured `PopSurface` face, so a ring of `tangerine`
  // shows as a frame around the white body nested inside it (the
  // `home-screen.tsx` `PuzzleCard` pattern).
  featureFrame: { padding: spacing.xs },
  featureBody: {
    height: 180,
    overflow: 'hidden',
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  featureImage: { width: '100%', height: '100%' },
  featureFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  prompt: { ...typography.heading, fontSize: 18, color: colors.ink, textAlign: 'center' },
});
