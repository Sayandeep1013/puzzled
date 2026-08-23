import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  dateKey,
  getCompletionsRepository,
  listCatalog,
  pickDailyPuzzle,
  resolvePuzzleImageSource,
  streakFrom,
} from '@/data';
import { type PuzzleDefinition } from '@/game-engine';
import { radii, spacing, typography } from '@/shared/theme';
import { useTheme } from '@/shared/theme-context';
import { createThemedStyles } from '@/shared/themed-styles';
import { Art, PopButton, PopHeader, PopSurface, Text } from '@/shared/ui';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
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
    // The completions log, not the live session row. Finishing today's daily and
    // then replaying it overwrote that row with an in-progress one, which took
    // the day's tick — and the streak with it — straight back off the calendar.
    const completions = await (await getCompletionsRepository()).list();
    playedToday = completions.some(
      (entry) => entry.puzzleId === puzzle.id && dateKey(new Date(entry.completedAt)) === key,
    );
  } catch {
    // Best-effort; an unreadable database still shows today's puzzle, it just
    // cannot confirm a completion to build a streak on.
  }

  return { puzzle, playedToday };
}

export function DailyScreen() {
  const theme = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const [data, setData] = useState<DailyData>(EMPTY);
  /** Day-of-month the player has tapped; `null` means today. */
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [pool, setPool] = useState<PuzzleDefinition[]>([]);

  // A UI-layer "now" — not something the pure daily helpers
  // (`dateKey`/`pickDailyPuzzle`/`streakFrom`) ever read themselves.
  const [today, setToday] = useState(() => new Date());
  const todayKey = useMemo(() => dateKey(today), [today]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      // Re-read the clock on every focus. This was captured once at mount, so an
      // app left open overnight still called yesterday "today": the calendar
      // highlighted the wrong cell, the pick was yesterday's, and the new day
      // could not be started at all. Guarded on the day actually changing, so
      // the ordinary focus does not churn state.
      const now = new Date();
      const nowKey = dateKey(now);
      if (nowKey !== todayKey) {
        setToday(now);
        // Also drop any day the player had selected: it was an offset into the
        // previous month's grid and means something different now.
        setSelectedDay(null);
        return () => {
          active = false;
        };
      }

      loadDailyData(todayKey).then((next) => {
        if (active) setData(next);
      });
      // The catalog is also held locally so tapping a past date can resolve that
      // date's pick without another round trip.
      listCatalog().then(({ bundled, user }) => {
        if (active) setPool([...bundled, ...user]);
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

  /**
   * The date the player is looking at, and its pick.
   *
   * `pickDailyPuzzle` is deterministic from a date key, so a past date resolves
   * to the puzzle that genuinely was that day's pick — real data, not invented
   * history. Today falls back to the loaded `data.puzzle` so the screen still
   * works before the catalog arrives.
   */
  const viewing = useMemo(() => {
    const day = selectedDay ?? calendar.today;
    const isToday = day === calendar.today;
    const date = new Date(today.getFullYear(), today.getMonth(), day);
    const key = dateKey(date);
    const puzzle = isToday ? data.puzzle : pickDailyPuzzle(pool, key);
    return {
      day,
      isToday,
      key,
      puzzle: puzzle ?? data.puzzle,
      label: `${MONTHS[today.getMonth()]} ${day}`,
    };
  }, [selectedDay, calendar.today, today, data.puzzle, pool]);

  const source = viewing.puzzle ? resolvePuzzleImageSource(viewing.puzzle) : null;

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <PopHeader title="Daily Puzzle" onBack={() => router.back()} />
        {/* Was a plain View, which is why the page could not scroll and the Play
            button sat off the bottom of the screen. */}
        <ScrollView contentContainerStyle={styles.content}>
          <PopSurface fill={theme.colors.surface} radius={radii.lg}>
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
                  if (day == null) {
                    return <View key={i} style={styles.dayCell} />;
                  }

                  const isToday = day === calendar.today;
                  const isFuture = day > calendar.today;
                  const isSelected = day === viewing.day;

                  return (
                    <View key={i} style={styles.dayCell}>
                      <Pressable
                        // Future days have no pick to show, so they stay inert
                        // rather than pretending to be tappable.
                        disabled={isFuture}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected, disabled: isFuture }}
                        accessibilityLabel={
                          isFuture
                            ? `${MONTHS[today.getMonth()]} ${day}, not yet unlocked`
                            : `${MONTHS[today.getMonth()]} ${day}`
                        }
                        onPress={() => setSelectedDay(day)}
                        style={[
                          styles.dayHit,
                          isSelected && styles.daySelected,
                          isToday && data.playedToday && styles.dayPlayed,
                        ]}
                      >
                        {isToday && data.playedToday ? (
                          <Art name="coin-check" size={22} />
                        ) : (
                          <Text
                            style={[
                              styles.dayText,
                              isSelected && styles.dayTextSelected,
                              isFuture && styles.dayTextFuture,
                            ]}
                          >
                            {day}
                          </Text>
                        )}
                      </Pressable>
                    </View>
                  );
                })}
              </View>
              <Text style={styles.calendarHint}>Tap any day up to today to see its puzzle.</Text>
            </View>
          </PopSurface>

          {/* Honey is light enough for direct ink text (10.08:1) — no white-body
              frame needed here, matching `home-screen.tsx`'s progress card. */}
          <PopSurface fill={theme.colors.honey} radius={radii.lg} contentStyle={styles.streakFrame}>
            <View style={styles.streakBody}>
              <View style={styles.streakIconWrap}>
                {/* The art set has no flame, and a flat Phosphor one would read
                    as foreign beside the illustrations — the calendar carries
                    "consecutive days" just as well. */}
                <Art name="calendar" size={30} />
              </View>
              <View style={styles.streakCopy}>
                <Text style={styles.streakValue}>
                  {streak > 0
                    ? `${streak} day${streak === 1 ? '' : 's'} streak`
                    : 'Start your streak today'}
                </Text>
                <Text style={styles.streakHint}>
                  {streak > 0
                    ? 'Nice! Come back tomorrow to keep it going.'
                    : "Finish today's puzzle to begin one."}
                </Text>
              </View>
            </View>
          </PopSurface>

          <PopSurface
            fill={theme.colors.surface}
            radius={radii.lg}
            contentStyle={styles.featureFrame}
          >
            <View style={styles.featureBody}>
              {source != null ? (
                <Image
                  source={typeof source === 'number' ? source : { uri: source }}
                  style={styles.featureImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.featureFallback}>
                  <Art name="calendar" size={64} />
                </View>
              )}
            </View>
          </PopSurface>

          <Text style={styles.prompt}>
            {viewing.puzzle
              ? `${viewing.isToday ? "Today's" : `${viewing.label}`} pick: ${viewing.puzzle.title}`
              : 'Import a photo from Library to unlock the daily pick.'}
          </Text>

          <PopButton
            label={
              viewing.isToday ? (data.playedToday ? 'Play again' : 'Play Now') : 'Play this puzzle'
            }
            tone="grass"
            icon={<Art name="play" size={24} />}
            disabled={!viewing.puzzle}
            onPress={() => {
              if (viewing.puzzle) {
                router.push({
                  pathname: '/difficulty/[puzzleId]',
                  params: { puzzleId: viewing.puzzle.id },
                });
              }
            }}
          />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const useStyles = createThemedStyles((theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.colors.paper },
    safe: { flex: 1 },
    // No `flex: 1` on a ScrollView's contentContainer: it would pin the content to
    // one viewport height and defeat scrolling, which is the bug being fixed.
    content: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.xl,
      gap: spacing.md,
      width: '100%',
      maxWidth: 560,
      alignSelf: 'center',
    },
    calendar: { padding: spacing.md, gap: spacing.sm },
    month: { ...typography.heading, color: theme.colors.headingGreen, textAlign: 'center' },
    weekRow: { flexDirection: 'row' },
    weekday: {
      ...typography.label,
      fontSize: 11,
      color: theme.colors.inkMuted,
      flex: 1,
      textAlign: 'center',
    },
    daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    dayCell: {
      width: `${100 / 7}%`,
      aspectRatio: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // The tap target is the circle itself, sized past the 44pt minimum once the
    // cell padding is counted.
    dayHit: {
      width: 38,
      height: 38,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    daySelected: { backgroundColor: theme.colors.grass },
    /**
     * Cancels `daySelected`'s fill under the completion coin.
     *
     * Applied after it, deliberately: today's cell draws `coin-check` art instead
     * of its number once the daily is finished, and a grass disc behind that coin
     * reads as a smudge rather than as a selection. Not dead style — removing it
     * puts the disc back.
     */
    dayPlayed: { backgroundColor: 'transparent' },
    dayText: { ...typography.body, color: theme.colors.ink },
    dayTextSelected: { ...typography.bodyStrong, color: theme.colors.onFill },
    dayTextFuture: { color: theme.colors.locked },
    calendarHint: {
      ...typography.caption,
      color: theme.colors.inkMuted,
      textAlign: 'center',
      marginTop: spacing.xs,
    },
    streakFrame: { padding: spacing.lg },
    streakBody: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    streakIconWrap: {
      width: 48,
      height: 48,
      borderRadius: radii.pill,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    streakCopy: { flex: 1, gap: 2 },
    streakValue: { ...typography.heading, fontSize: 18, color: theme.colors.ink },
    streakHint: { ...typography.caption, color: theme.colors.ink },
    // Inset padding on the coloured `PopSurface` face, so a ring of `tangerine`
    // shows as a frame around the white body nested inside it (the
    // `home-screen.tsx` `PuzzleCard` pattern).
    featureFrame: { padding: spacing.xs },
    featureBody: {
      height: 180,
      overflow: 'hidden',
      borderRadius: radii.md,
      backgroundColor: theme.colors.surface,
    },
    featureImage: { width: '100%', height: '100%' },
    featureFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    prompt: { ...typography.heading, fontSize: 18, color: theme.colors.ink, textAlign: 'center' },
  }),
);
