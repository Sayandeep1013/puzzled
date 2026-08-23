import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ACHIEVEMENT_REWARD,
  deriveAchievements,
  getCompletionsRepository,
  getWalletRepository,
  type AchievementState,
} from '@/data';
import { type ArtName } from '@/shared/art';
import { useTheme } from '@/shared/theme-context';
import { type Theme } from '@/shared/themes';
import { createThemedStyles } from '@/shared/themed-styles';
import { radii, spacing, typography } from '@/shared/theme';
import { Art, PopHeader, PopProgress, PopSurface, Text } from '@/shared/ui';

/**
 * The data layer emits `tone` as a semantic token name and `icon` as a plain
 * string — deliberately free of any `@/shared/ui` or palette import (see
 * `src/data/local/achievements-repository.ts`). This screen is the render
 * boundary that maps both onto real Puzzle Journey values.
 */
function toneColor(theme: Theme, tone: AchievementState['tone']): string {
  // A function of the theme, not a module-level map: a map is built once, at
  // import, against whichever palette happened to be loaded — the same
  // build-time binding that made the whole app single-themed.
  const byTone: Record<AchievementState['tone'], string> = {
    grass: theme.colors.grass,
    berry: theme.colors.berry,
    blossom: theme.colors.blossom,
    honey: theme.colors.honey,
  };
  return byTone[tone];
}

/** Every icon name `deriveAchievements` currently emits, mapped onto the art set. */
const ICON_ART: Record<string, ArtName> = {
  check: 'shield-star',
  puzzle: 'my-trophies',
  medal: 'badge-1st',
  sparkle: 'cup-star',
};

/** An icon name the data layer hasn't emitted yet still renders something sane. */
function resolveArt(icon: string): ArtName {
  return ICON_ART[icon] ?? 'cup';
}

async function loadAchievements(): Promise<AchievementState[]> {
  try {
    return deriveAchievements(await (await getCompletionsRepository()).list());
  } catch {
    // Best-effort; an unreadable database still shows every achievement
    // honestly at 0 progress rather than crashing the screen.
    return deriveAchievements([]);
  }
}

/**
 * Pay for every achievement that is unlocked but has not been paid for.
 *
 * Achievements awarded nothing at all until now — you could unlock all four and
 * end up with the same balance you started with, which makes the screen a
 * scoreboard rather than a reward. There is no "claim" button because there is
 * nothing to decide: `recordOnce` is keyed on the achievement, so this is
 * idempotent and paying on sight is indistinguishable from claiming.
 *
 * Fire-and-forget: a failed credit is retried the next time this screen opens,
 * and must never stop the list from rendering.
 */
async function payForUnlocked(states: readonly AchievementState[]): Promise<void> {
  const unlocked = states.filter((state) => state.unlocked);
  if (unlocked.length === 0) {
    return;
  }
  try {
    const wallet = await getWalletRepository();
    for (const state of unlocked) {
      await wallet.recordOnce({
        deltaCoins: ACHIEVEMENT_REWARD,
        deltaHints: 0,
        reason: 'achievement-unlock',
        ref: state.key,
      });
    }
  } catch {
    // Best-effort; the next visit tries again.
  }
}

export function AchievementsScreen() {
  const styles = useStyles();
  const router = useRouter();
  const [achievements, setAchievements] = useState<AchievementState[]>(() =>
    deriveAchievements([]),
  );

  // Refetch on focus so an achievement earned on the board is reflected
  // immediately on return, matching `home-screen.tsx`'s pattern.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadAchievements().then((next) => {
        if (!active) {
          return;
        }
        setAchievements(next);
        void payForUnlocked(next);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <PopHeader title="Achievements" onBack={() => router.back()} />
        <ScrollView contentContainerStyle={styles.content}>
          {achievements.map((achievement) => (
            <AchievementRow key={achievement.key} achievement={achievement} />
          ))}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function AchievementRow({ achievement }: { achievement: AchievementState }) {
  const theme = useTheme();
  const styles = useStyles();
  const tone = toneColor(theme, achievement.tone);

  return (
    // The trophy art carries the achievement's identity, so the row is a plain
    // cream card. `tone` survives as the progress-bar fill only — which is where
    // it can be saturated without any text sitting on it.
    <PopSurface fill={theme.colors.surface} radius={radii.md} contentStyle={styles.rowBody}>
      <Art
        name={resolveArt(achievement.icon)}
        size={52}
        style={achievement.unlocked ? undefined : styles.locked}
      />
      <View style={styles.body}>
        <Text style={styles.title}>{achievement.title}</Text>
        <Text style={styles.desc}>
          {achievement.unlocked
            ? `Unlocked · ${ACHIEVEMENT_REWARD} coins`
            : `${achievement.description} · ${ACHIEVEMENT_REWARD} coins`}
        </Text>
        <PopProgress value={achievement.current} goal={achievement.goal} tone={tone} height={10} />
      </View>
      <View style={styles.trailing}>
        {achievement.unlocked ? (
          <Art name="coin-check" size={26} accessibilityLabel="Unlocked" />
        ) : (
          <Text numberOfLines={1} style={styles.count}>
            {achievement.current}/{achievement.goal}
          </Text>
        )}
      </View>
    </PopSurface>
  );
}

const useStyles = createThemedStyles((theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.colors.paper },
    safe: { flex: 1 },
    content: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.xl,
      gap: spacing.md,
      width: '100%',
      maxWidth: 720,
      alignSelf: 'center',
    },
    rowBody: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
    },
    // A locked trophy is dimmed rather than swapped for a padlock, so the row
    // still previews the reward you are working toward.
    locked: { opacity: 0.4 },
    body: { flex: 1, gap: 4 },
    title: { ...typography.heading, fontSize: 18, color: theme.colors.ink },
    desc: { ...typography.caption, color: theme.colors.inkMuted },
    trailing: { minWidth: 42, alignItems: 'flex-end' },
    count: { ...typography.bodyStrong, fontSize: 13, color: theme.colors.inkMuted },
  }),
);
