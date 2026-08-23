import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ImageBackground, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  dateKey,
  getCompletionsRepository,
  getProgressRepository,
  getWalletRepository,
  listCatalog,
  pickDailyPuzzle,
  resolvePuzzleImageSource,
} from '@/data';
import { type GridSize, type PuzzleDefinition } from '@/game-engine';
import { type ArtName } from '@/shared/art';
import { colors, radii, shadow, spacing, typography } from '@/shared/theme';
import {
  Art,
  EnterView,
  IdleBob,
  PopButton,
  PopSurface,
  Text,
  useTabBarSpace,
  WordmarkTitle,
} from '@/shared/ui';

const HOME_BACKGROUND = require('../../../assets/backgrounds/home.png');

/** Coins for finishing the puzzle picked for today. */
export const DAILY_CHALLENGE_REWARD = 50;

/** Bear size inside the challenge card, in points. */
const CARD_BEAR = 112;
/** Thumbnail edge in the Continue Playing strip, in points. */
const THUMB = 84;
/** How many boards the strip shows before it is just a list. */
const CONTINUE_LIMIT = 8;

interface ContinueItem {
  puzzleId: string;
  gridSize: GridSize;
  title: string;
  source: number | string | null;
  percent: number;
}

interface DailyPick {
  puzzle: PuzzleDefinition;
  source: number | string | null;
  doneToday: boolean;
}

interface HomeData {
  /** First puzzle the Play button can start when there is nothing to resume. */
  firstPlayable: PuzzleDefinition | null;
  /**
   * Boards in progress, most recently played first.
   *
   * Home's Play button used to ignore progress entirely and always open the
   * difficulty picker for `bundled[0]` — while Puzzles, Library and Pack all
   * resumed the last session. The strip makes every one of them reachable, and
   * `[0]` is what the button itself resumes.
   */
  continuePlaying: ContinueItem[];
  /** Today's pick, or null before the catalog arrives. */
  daily: DailyPick | null;
  /** Null rather than a fabricated zero when the wallet cannot be read. */
  coins: number | null;
}

const EMPTY: HomeData = { firstPlayable: null, continuePlaying: [], daily: null, coins: null };

async function loadHomeData(todayKey: string): Promise<HomeData> {
  const { bundled, user } = await listCatalog();
  const pool = [...bundled, ...user];
  const byId = new Map(pool.map((puzzle) => [puzzle.id, puzzle]));

  let coins: number | null = null;
  try {
    coins = (await (await getWalletRepository()).balance()).coins;
  } catch {
    // Same contract as the coins screen: no balance is better than a wrong one.
  }

  let continuePlaying: ContinueItem[] = [];
  try {
    // Summaries arrive most-recent-first, so this strip is in "last played"
    // order without sorting. Rows for puzzles no longer in the catalog are
    // dropped rather than shown — following one lands on "Puzzle not found".
    const rows = await (await getProgressRepository()).listSummaries();
    continuePlaying = rows
      .filter((row) => row.status !== 'completed' && row.lockedPieces > 0 && byId.has(row.puzzleId))
      .slice(0, CONTINUE_LIMIT)
      .map((row) => {
        const puzzle = byId.get(row.puzzleId) as PuzzleDefinition;
        return {
          puzzleId: row.puzzleId,
          gridSize: row.gridSize,
          title: puzzle.title,
          source: resolvePuzzleImageSource(puzzle),
          percent: Math.round((row.lockedPieces / row.totalPieces) * 100),
        };
      });
  } catch {
    // Progress is best-effort; without it Home simply starts something new.
  }

  let daily: DailyPick | null = null;
  const pick = pickDailyPuzzle(pool, todayKey);
  if (pick) {
    let doneToday = false;
    try {
      const completions = await (await getCompletionsRepository()).list();
      doneToday = completions.some(
        (entry) => entry.puzzleId === pick.id && dateKey(new Date(entry.completedAt)) === todayKey,
      );
    } catch {
      // Best-effort; an unreadable log just means the card still invites a play.
    }
    daily = { puzzle: pick, source: resolvePuzzleImageSource(pick), doneToday };
  }

  return { firstPlayable: bundled[0] ?? user[0] ?? null, continuePlaying, daily, coins };
}

/**
 * Home, as the mockup's dashboard rather than a landing screen.
 *
 * It was deliberately cut back to logo, mascot and three buttons once, on the
 * grounds that it had grown into a dashboard. The new mockup asks for one
 * again — but a *useful* one: the things it surfaces (today's pick, the boards
 * you have open) are the two questions a returning player actually has, and
 * both were previously two taps away on other tabs.
 *
 * The mascot moves into the challenge card rather than standing alone, which is
 * what makes room for all of it without a second screenful of scrolling.
 */
export function HomeScreen() {
  const router = useRouter();
  const [data, setData] = useState<HomeData>(EMPTY);
  const tabBarSpace = useTabBarSpace();

  // Re-read on focus rather than at mount, so crossing midnight with the app
  // open rolls the daily pick over instead of pinning yesterday's.
  const [today, setToday] = useState(() => dateKey(new Date()));

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const now = dateKey(new Date());
      if (now !== today) {
        setToday(now);
        return () => {
          active = false;
        };
      }
      loadHomeData(today).then((next) => {
        if (active) setData(next);
      });
      return () => {
        active = false;
      };
    }, [today]),
  );

  /**
   * Pay the challenge reward once the daily is finished.
   *
   * Paid here rather than on the board, because the board has no idea which
   * puzzle happens to be today's pick — it would have to load the whole catalog
   * mid-game to find out. `recordOnce` is keyed on the day, so arriving at this
   * screen repeatedly cannot pay twice, and a player who finishes the daily and
   * never opens Home is paid the next time they do.
   */
  const dailyDone = data.daily?.doneToday ?? false;
  useEffect(() => {
    if (!dailyDone) {
      return;
    }
    void (async () => {
      try {
        await (
          await getWalletRepository()
        ).recordOnce({
          deltaCoins: DAILY_CHALLENGE_REWARD,
          deltaHints: 0,
          reason: 'daily-complete',
          ref: today,
        });
      } catch {
        // Best-effort; the next visit tries again.
      }
    })();
  }, [dailyDone, today]);

  const resume = data.continuePlaying[0] ?? null;

  const openBoard = useCallback(
    (puzzleId: string, gridSize: GridSize) => {
      router.push({
        pathname: '/game/[puzzleId]',
        params: { puzzleId, size: String(gridSize) },
      });
    },
    [router],
  );

  return (
    // One cover-fitted image rather than stacked colour bands. The bands could
    // never line up with scrolling content, which is what made the old seam cut
    // across cards.
    <ImageBackground source={HOME_BACKGROUND} resizeMode="cover" style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.topBar}>
          {/* The pill is a button now. A balance you can see and not act on is
              a dead end — the `+` is the only route to where coins come from. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${data.coins ?? 'Unknown'} coins. Get more.`}
            onPress={() => router.push('/coins')}
            style={styles.coinPill}
          >
            <Art name="coin" size={26} />
            <Text style={styles.coinText} numberOfLines={1}>
              {data.coins ?? '—'}
            </Text>
            <View style={styles.coinPlus}>
              <Text style={styles.coinPlusGlyph}>+</Text>
            </View>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Settings"
            hitSlop={10}
            onPress={() => router.push('/settings')}
            style={styles.gearButton}
          >
            <Art name="gear" size={26} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[styles.body, { paddingBottom: tabBarSpace }]}
          showsVerticalScrollIndicator={false}
        >
          <EnterView index={0}>
            <WordmarkTitle />
          </EnterView>

          {data.daily ? (
            <EnterView index={1} style={styles.block}>
              <PopSurface
                fill={colors.surface}
                radius={radii.lg}
                contentStyle={styles.challengeBody}
              >
                <View style={styles.challengeCopy}>
                  <Text style={styles.challengeTitle}>Today&apos;s Challenge</Text>
                  <Text style={styles.challengeMeta}>
                    {data.daily.doneToday
                      ? `Done! ${DAILY_CHALLENGE_REWARD} coins earned.`
                      : `Complete “${data.daily.puzzle.title}” and earn ${DAILY_CHALLENGE_REWARD} coins.`}
                  </Text>
                  <PopButton
                    label={data.daily.doneToday ? 'Play again' : 'Play Now'}
                    tone="grass"
                    size="sm"
                    icon={<Art name="play" size={20} />}
                    style={styles.challengeButton}
                    onPress={() => router.push('/daily')}
                  />
                </View>
                {/* The bear lives here now rather than standing alone above the
                    buttons — which is what makes room for the rest of the page. */}
                <IdleBob distance={6} sway={2}>
                  <Art name="bear" size={CARD_BEAR} />
                </IdleBob>
              </PopSurface>
            </EnterView>
          ) : null}

          {data.continuePlaying.length > 0 ? (
            <EnterView index={2} style={styles.block}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>Continue Playing</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="See every puzzle"
                  onPress={() => router.push('/puzzles')}
                >
                  <Text style={styles.seeAll}>View All</Text>
                </Pressable>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.strip}
              >
                {data.continuePlaying.map((item) => (
                  <ContinueThumb
                    key={`${item.puzzleId}-${item.gridSize}`}
                    item={item}
                    onPress={() => openBoard(item.puzzleId, item.gridSize)}
                  />
                ))}
              </ScrollView>
            </EnterView>
          ) : null}

          <EnterView index={3} style={[styles.block, styles.actions]}>
            <PopButton
              // The label follows the destination: "Play" opening a half-finished
              // board would be as wrong as "Continue" starting a new one.
              label={resume ? 'Continue' : 'Play'}
              tone="grass"
              size="lg"
              icon={<Art name={resume ? 'resume' : 'play'} size={28} />}
              style={styles.fullWidth}
              disabled={!resume && !data.firstPlayable}
              onPress={() => {
                if (resume) {
                  openBoard(resume.puzzleId, resume.gridSize);
                  return;
                }
                if (data.firstPlayable) {
                  router.push({
                    pathname: '/difficulty/[puzzleId]',
                    params: { puzzleId: data.firstPlayable.id },
                  });
                }
              }}
            />

            <View style={styles.quickRow}>
              <QuickLink
                art="calendar"
                label="Daily Puzzle"
                onPress={() => router.push('/daily')}
              />
              <QuickLink art="album" label="My Album" onPress={() => router.push('/library')} />
            </View>
          </EnterView>
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}

/** One board in the Continue Playing strip, with how far through it is. */
function ContinueThumb({ item, onPress }: { item: ContinueItem; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Continue ${item.title}, ${item.percent} percent done`}
      onPress={onPress}
      style={styles.thumbWrap}
    >
      <View style={styles.thumb}>
        {item.source != null ? (
          <ImageBackground
            source={typeof item.source === 'number' ? item.source : { uri: item.source }}
            style={styles.thumbImage}
            resizeMode="cover"
          />
        ) : (
          <Art name="puzzle-quad" size={40} />
        )}
      </View>
      <Text style={styles.thumbMeta} numberOfLines={1}>
        {item.percent}%
      </Text>
    </Pressable>
  );
}

function QuickLink({ art, label, onPress }: { art: ArtName; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.quickLink}
    >
      <PopSurface fill={colors.surface} radius={radii.md}>
        <View style={styles.quickLinkInner}>
          <Art name={art} size={30} />
          {/* `numberOfLines` with a shrinkable style, or the label loses letters.
              `PopSurface`'s face clips (`overflow: 'hidden'`), and an unshrinkable
              `Text` in a centred row overflows that face rather than narrowing — so
              when the label does not fit, the ends are simply cut off with nothing to
              show for it. Shrinking degrades to an ellipsis instead, which is legible
              and obviously deliberate. */}
          <Text style={styles.quickLinkLabel} numberOfLines={1}>
            {label}
          </Text>
        </View>
      </PopSurface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  safeArea: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  coinPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingLeft: spacing.xs,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    boxShadow: shadow.card,
  },
  coinText: { ...typography.heading, fontSize: 18, color: colors.ink, paddingHorizontal: 2 },
  // A green disc rather than an outline, matching the mockup's pill.
  coinPlus: {
    width: 26,
    height: 26,
    borderRadius: radii.pill,
    backgroundColor: colors.grassDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinPlusGlyph: {
    ...typography.heading,
    fontSize: 20,
    lineHeight: 24,
    color: colors.onFill,
  },
  gearButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    boxShadow: shadow.card,
  },
  // Scrolls now: the dashboard carries more than one viewport on a short phone,
  // and pinning it meant the quick links sat under the tab bar.
  body: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.lg,
  },
  block: { alignSelf: 'stretch' },
  challengeBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  challengeCopy: { flex: 1, gap: spacing.xs },
  challengeTitle: { ...typography.heading, fontSize: 19, color: colors.ink },
  challengeMeta: { ...typography.caption, color: colors.inkMuted },
  challengeButton: { alignSelf: 'flex-start', marginTop: spacing.xs },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  // On the meadow rather than on a card, so these need the outlined treatment
  // the pack screen uses on its saturated ground.
  sectionTitle: { ...typography.heading, fontSize: 19, color: colors.onFill },
  seeAll: { ...typography.caption, color: colors.onFill },
  strip: { gap: spacing.sm, paddingRight: spacing.md },
  thumbWrap: { alignItems: 'center', gap: 4 },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: shadow.card,
  },
  thumbImage: { width: '100%', height: '100%' },
  thumbMeta: { ...typography.caption, fontSize: 12, color: colors.onFill, paddingHorizontal: 2 },
  actions: { gap: spacing.md },
  fullWidth: { alignSelf: 'stretch' },
  quickRow: { flexDirection: 'row', gap: spacing.md, alignSelf: 'stretch' },
  quickLink: { flex: 1 },
  quickLinkInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  // `flexShrink` so the label gives way before the clipping face does — see QuickLink.
  quickLinkLabel: {
    ...typography.bodyStrong,
    fontSize: 14,
    color: colors.ink,
    flexShrink: 1,
    // Two points of horizontal slack, which is measurement headroom, not spacing.
    // Android measures a `Text`'s intrinsic width and draws its glyphs with
    // slightly different rounding, and an OS font scale makes `fontSize`
    // fractional (14 x 0.85 = 11.9) which widens the gap. When the drawn string
    // needs marginally more than the measured box, `numberOfLines={1}` ellipsises
    // a label that had hundreds of points of room beside it — measured on device:
    // "My Album" truncated to "My Alb..." inside a card 356px wide.
    paddingHorizontal: 2,
  },
});
