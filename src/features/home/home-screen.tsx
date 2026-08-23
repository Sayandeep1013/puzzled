import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ImageBackground, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getProgressRepository, getWalletRepository, listCatalog } from '@/data';
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

/**
 * Bear size, in points. Sized for this screen alone.
 *
 * It used to claim it was kept equal to the splash's `imageWidth` — it was not
 * (176), and it should not be: `LoadingScreen` owns the launch handoff now and
 * cross-fades into Home rather than handing a bear straight over to it. Matching
 * the splash here would only make Home's mascot small.
 */
const MASCOT_SIZE = 254;

/** The board Play resumes, when there is one. */
interface ResumeTarget {
  puzzleId: string;
  gridSize: GridSize;
}

interface HomeData {
  /** First puzzle the Play button can start when there is nothing to resume. */
  firstPlayable: PuzzleDefinition | null;
  /**
   * Most recently played unfinished board.
   *
   * Home's Play button used to ignore progress entirely and always open the
   * difficulty picker for `bundled[0]` — while Puzzles, Library and Pack all
   * resumed the last session. So the most prominent button in the app was the
   * one that could not get you back to the puzzle you were in the middle of.
   */
  resume: ResumeTarget | null;
  /** Null rather than a fabricated zero when the wallet cannot be read. */
  coins: number | null;
}

const EMPTY: HomeData = { firstPlayable: null, resume: null, coins: null };

async function loadHomeData(): Promise<HomeData> {
  const { bundled, user } = await listCatalog();
  const known = new Set([...bundled, ...user].map((puzzle) => puzzle.id));

  let coins: number | null = null;
  try {
    coins = (await (await getWalletRepository()).balance()).coins;
  } catch {
    // Same contract as the shop: no balance is better than a wrong one.
  }

  let resume: ResumeTarget | null = null;
  try {
    // Summaries arrive most-recent-first, so the first match is the board the
    // player was last on. Rows for puzzles no longer in the catalog are skipped
    // rather than offered — following one would land on "Puzzle not found".
    const rows = await (await getProgressRepository()).listSummaries();
    const latest = rows.find(
      (row) => row.status !== 'completed' && row.lockedPieces > 0 && known.has(row.puzzleId),
    );
    resume = latest ? { puzzleId: latest.puzzleId, gridSize: latest.gridSize } : null;
  } catch {
    // Progress is best-effort; without it Play simply starts something new.
  }

  return { firstPlayable: bundled[0] ?? user[0] ?? null, resume, coins };
}

/**
 * Home is deliberately only what the team's mockup shows: the meadow, the coin
 * balance, the logo, the mascot, and three buttons.
 *
 * Progress moved to `statistics`, the starter list to `puzzles`, and photo import
 * to `library`'s My Photos tab — each to the screen that already owns that data.
 * Home previously carried all of it and read as a dashboard rather than a
 * landing screen.
 */
export function HomeScreen() {
  const [data, setData] = useState<HomeData>(EMPTY);
  const router = useRouter();
  const tabBarSpace = useTabBarSpace();

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadHomeData().then((next) => {
        if (active) setData(next);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const { firstPlayable } = data;

  return (
    // One cover-fitted image rather than stacked colour bands. The bands could
    // never line up with scrolling content, which is what made the old seam cut
    // across cards.
    <ImageBackground source={HOME_BACKGROUND} resizeMode="cover" style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.topBar}>
          <View style={styles.coinPill}>
            <Art name="coin" size={26} />
            <Text style={styles.coinText}>{data.coins ?? '—'}</Text>
          </View>
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

        {/* Logo, mascot then actions rise in that order, which is also the order
            the eye should read them. The bear keeps breathing afterwards — sitting
            perfectly still is what made it read as a sticker rather than a mascot. */}
        <View style={[styles.body, { paddingBottom: tabBarSpace }]}>
          <EnterView index={0}>
            <WordmarkTitle />
          </EnterView>

          {/* The mascot absorbs the slack between logo and actions, so the
              layout holds on both short and tall screens. */}
          <EnterView index={1} style={styles.mascotWrap}>
            <IdleBob distance={9} sway={2}>
              <Art name="bear" size={MASCOT_SIZE} />
            </IdleBob>
          </EnterView>

          <EnterView index={2} style={styles.actions}>
            <PopButton
              // The label follows the destination: "Play" opening a half-finished
              // board would be as wrong as "Continue" starting a new one.
              label={data.resume ? 'Continue' : 'Play'}
              tone="grass"
              size="lg"
              icon={<Art name={data.resume ? 'resume' : 'play'} size={28} />}
              style={styles.fullWidth}
              disabled={!data.resume && !firstPlayable}
              onPress={() => {
                if (data.resume) {
                  router.push({
                    pathname: '/game/[puzzleId]',
                    params: {
                      puzzleId: data.resume.puzzleId,
                      size: String(data.resume.gridSize),
                    },
                  });
                  return;
                }
                if (firstPlayable) {
                  router.push({
                    pathname: '/difficulty/[puzzleId]',
                    params: { puzzleId: firstPlayable.id },
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
        </View>
      </SafeAreaView>
    </ImageBackground>
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
    paddingRight: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    boxShadow: shadow.card,
  },
  coinText: { ...typography.heading, fontSize: 18, color: colors.ink },
  gearButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    boxShadow: shadow.card,
  },
  // No ScrollView: Home now fits one screen by design. The logo sits high, the
  // mascot takes the slack, and the actions are pinned to the bottom.
  body: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  mascotWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  actions: { alignSelf: 'stretch', gap: spacing.md },
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
  quickLinkLabel: { ...typography.bodyStrong, fontSize: 14, color: colors.ink, flexShrink: 1 },
});
