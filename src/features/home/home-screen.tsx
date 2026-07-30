import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getWalletRepository, listCatalog } from '@/data';
import { type PuzzleDefinition } from '@/game-engine';
import { type ArtName } from '@/shared/art';
import { colors, radii, shadow, spacing, typography } from '@/shared/theme';
import { Art, PopButton, PopSurface, WordmarkTitle, useTabBarSpace } from '@/shared/ui';

const HOME_BACKGROUND = require('../../../assets/backgrounds/home.png');

/**
 * Bear size, in points. Kept equal to `imageWidth` on the splash screen in
 * `app.json`, so the mascot is the same size before and after the app loads and
 * does not visibly re-draw on launch.
 */
const MASCOT_SIZE = 254;

interface HomeData {
  /** First puzzle the Play button can start. */
  firstPlayable: PuzzleDefinition | null;
  /** Null rather than a fabricated zero when the wallet cannot be read. */
  coins: number | null;
}

const EMPTY: HomeData = { firstPlayable: null, coins: null };

async function loadHomeData(): Promise<HomeData> {
  const { bundled, user } = await listCatalog();

  let coins: number | null = null;
  try {
    coins = (await (await getWalletRepository()).balance()).coins;
  } catch {
    // Same contract as the shop: no balance is better than a wrong one.
  }

  return { firstPlayable: bundled[0] ?? user[0] ?? null, coins };
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

        <View style={[styles.body, { paddingBottom: tabBarSpace }]}>
          <WordmarkTitle />

          {/* The mascot absorbs the slack between logo and actions, so the
              layout holds on both short and tall screens. */}
          <View style={styles.mascotWrap}>
            <Art name="bear" size={MASCOT_SIZE} />
          </View>

          <View style={styles.actions}>
            <PopButton
              label="Play"
              tone="grass"
              size="lg"
              icon={<Art name="play" size={28} />}
              style={styles.fullWidth}
              disabled={!firstPlayable}
              onPress={() => {
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
          </View>
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
          <Text style={styles.quickLinkLabel}>{label}</Text>
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
  quickLinkLabel: { ...typography.bodyStrong, fontSize: 14, color: colors.ink },
});
