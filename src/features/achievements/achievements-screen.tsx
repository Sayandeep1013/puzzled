import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { deriveAchievements, getCompletionsRepository, type AchievementState } from '@/data';
import { type ArtName } from '@/shared/art';
import { colors, radii, spacing, typography } from '@/shared/theme';
import { Art, PopHeader, PopProgress, PopSurface, Text } from '@/shared/ui';

/**
 * The data layer emits `tone` as a semantic token name and `icon` as a plain
 * string — deliberately free of any `@/shared/ui` or palette import (see
 * `src/data/local/achievements-repository.ts`). This screen is the render
 * boundary that maps both onto real Puzzle Journey values.
 */
const TONE_COLOR: Record<AchievementState['tone'], string> = {
  grass: colors.grass,
  berry: colors.berry,
  blossom: colors.blossom,
  honey: colors.honey,
};

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

export function AchievementsScreen() {
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
        if (active) setAchievements(next);
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
  const tone = TONE_COLOR[achievement.tone];

  return (
    // The trophy art carries the achievement's identity, so the row is a plain
    // cream card. `tone` survives as the progress-bar fill only — which is where
    // it can be saturated without any text sitting on it.
    <PopSurface fill={colors.surface} radius={radii.md} contentStyle={styles.rowBody}>
      <Art
        name={resolveArt(achievement.icon)}
        size={52}
        style={achievement.unlocked ? undefined : styles.locked}
      />
      <View style={styles.body}>
        <Text style={styles.title}>{achievement.title}</Text>
        <Text style={styles.desc}>{achievement.description}</Text>
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  safe: { flex: 1 },
  content: {
    paddingHorizontal: spacing.lg,
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
  title: { ...typography.heading, fontSize: 18, color: colors.ink },
  desc: { ...typography.caption, color: colors.inkMuted },
  trailing: { minWidth: 42, alignItems: 'flex-end' },
  count: { ...typography.bodyStrong, fontSize: 13, color: colors.inkMuted },
});
