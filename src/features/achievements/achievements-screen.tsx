import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  deriveAchievements,
  getProgressRepository,
  type AchievementState,
  type PuzzleProgressSummary,
} from '@/data';
import { colors, radii, spacing, typography } from '@/shared/theme';
import { PopHeader, PopIcon, PopProgress, PopSurface, type PopIconName } from '@/shared/ui';

/**
 * The data layer emits `tone` as a semantic token name and `icon` as a plain
 * string — deliberately free of any `@/shared/ui` or palette import (see
 * `src/data/local/achievements-repository.ts`). This screen is the render
 * boundary that maps both onto real Chunky Pop values.
 */
const TONE_COLOR: Record<AchievementState['tone'], string> = {
  mint: colors.mint,
  grape: colors.grape,
  bubblegum: colors.bubblegum,
  sunshine: colors.sunshine,
};

/** Text/icon colour that stays readable on each tone's fill (mirrors `PopButton`'s contrast table). */
const ON_TONE: Record<AchievementState['tone'], string> = {
  mint: colors.ink,
  grape: colors.onFill,
  bubblegum: colors.onFill,
  sunshine: colors.ink,
};

/** Every icon name `deriveAchievements` currently emits, confirmed against `PopIcon`'s map. */
const ICON: Record<string, PopIconName> = {
  check: 'check',
  puzzle: 'puzzle',
  medal: 'medal',
  sparkle: 'sparkle',
};

/** An icon name the data layer hasn't emitted yet still renders something sane. */
function resolveIcon(icon: string): PopIconName {
  return ICON[icon] ?? 'trophy';
}

async function loadAchievements(): Promise<AchievementState[]> {
  try {
    const summaries = await (await getProgressRepository()).listSummaries();
    return deriveAchievements(summaries);
  } catch {
    // Progress is best-effort; an unreadable database still shows every
    // achievement honestly at 0 progress rather than crashing the screen.
    return deriveAchievements([] as PuzzleProgressSummary[]);
  }
}

export function AchievementsScreen() {
  const router = useRouter();
  const [achievements, setAchievements] = useState<AchievementState[]>(() => deriveAchievements([]));

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
  const onTone = ON_TONE[achievement.tone];
  const icon = resolveIcon(achievement.icon);

  return (
    <PopSurface fill={tone} radius={radii.md} contentStyle={styles.rowFrame}>
      <View style={styles.rowBody}>
        <View style={[styles.badge, { backgroundColor: tone }]}>
          <PopIcon name={icon} size={26} color={onTone} />
        </View>
        <View style={styles.body}>
          <Text style={styles.title}>{achievement.title}</Text>
          <Text style={styles.desc}>{achievement.description}</Text>
          <PopProgress
            value={achievement.current}
            goal={achievement.goal}
            tone={tone}
            height={10}
          />
        </View>
        <View style={styles.trailing}>
          {achievement.unlocked ? (
            <PopIcon name="check" size={22} color={colors.mint} />
          ) : (
            <Text style={styles.count}>
              {achievement.current}/{achievement.goal}
            </Text>
          )}
        </View>
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
  // Inset padding on the coloured `PopSurface` face, so a ring of `tone` shows
  // as a frame around the white row body nested inside it (the `home-screen.tsx`
  // `PuzzleCard` pattern) — ink-on-saturated-fill body text fails contrast.
  rowFrame: { padding: spacing.xs },
  rowBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
  },
  badge: {
    width: 48,
    height: 48,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 4 },
  title: { ...typography.heading, fontSize: 18, color: colors.ink },
  desc: { ...typography.caption, color: colors.inkMuted },
  trailing: { minWidth: 42, alignItems: 'flex-end' },
  count: { ...typography.bodyStrong, fontSize: 13, color: colors.inkMuted },
});
