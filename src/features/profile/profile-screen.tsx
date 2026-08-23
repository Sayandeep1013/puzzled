import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getCompletionsRepository,
  getProgressRepository,
  latestPerBoard,
  type PuzzleProgressSummary,
} from '@/data';
import { radii, spacing, typography } from '@/shared/theme';
import { useTheme } from '@/shared/theme-context';
import { createThemedStyles } from '@/shared/themed-styles';
import { type ArtName } from '@/shared/art';
import { Art, PopIcon, PopSurface, Text, useTabBarSpace } from '@/shared/ui';

/**
 * There is no accounts system yet (Phase 2). Every player is shown the same
 * placeholder identity rather than a fabricated name or email address.
 */
const PLACEHOLDER_NAME = 'Player';

export function ProfileScreen() {
  const theme = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const [completed, setCompleted] = useState(0);
  const [piecesPlaced, setPiecesPlaced] = useState(0);
  const tabBarSpace = useTabBarSpace();

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const rows = await (
          await getProgressRepository()
        )
          .listSummaries()
          .catch(() => [] as PuzzleProgressSummary[]);
        // Completions come from the append-only log, not from the live session
        // rows: replaying a finished puzzle overwrites its row, and this figure
        // used to fall back down when it did.
        const completions = await getCompletionsRepository()
          .then((repository) => repository.list())
          .catch(() => []);
        if (active) {
          // Distinct boards finished, so replaying one does not inflate the count
          // the way it would on the achievements screen (where a replay is a
          // genuine second completion).
          setCompleted(latestPerBoard(completions).length);
          setPiecesPlaced(rows.reduce((sum, row) => sum + row.lockedPieces, 0));
        }
      })();
      return () => {
        active = false;
      };
    }, []),
  );

  const links: { art: ArtName; label: string; onPress: () => void }[] = [
    { art: 'my-trophies', label: 'Achievements', onPress: () => router.push('/achievements') },
    { art: 'coin', label: 'Coins', onPress: () => router.push('/coins') },
    { art: 'sticker-book', label: 'Themes', onPress: () => router.push('/themes') },
    { art: 'bars', label: 'Statistics', onPress: () => router.push('/statistics') },
    { art: 'gear', label: 'Settings', onPress: () => router.push('/settings') },
  ];

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.headerRow}>
          <Text style={styles.pageTitle}>Profile</Text>
        </View>

        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace }]}>
          <View style={styles.identity}>
            {/* No circular surface. `change-avatar` is a sticker that already
                carries its own white outline, and clipping it to a pill cut the
                bear's ears off while the fill swamped the art. */}
            <Art name="change-avatar" size={132} accessibilityLabel="Your avatar" />
            <Text style={styles.name}>{PLACEHOLDER_NAME}</Text>
          </View>

          {/* Two figures, not one. The pieces-placed count was on Home before it
              moved to Statistics, and Statistics is two taps away — so the
              headline number surfaces here, on a tab, where it is findable. */}
          <PopSurface fill={theme.colors.surface} radius={radii.lg}>
            <View style={styles.statRow}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{completed}</Text>
                <Text style={styles.statLabel}>COMPLETED</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statValue}>{piecesPlaced}</Text>
                <Text style={styles.statLabel}>PIECES PLACED</Text>
              </View>
            </View>
          </PopSurface>

          <View style={styles.links}>
            {links.map((link) => (
              <Pressable key={link.label} accessibilityRole="button" onPress={link.onPress}>
                <PopSurface fill={theme.colors.surface} radius={radii.md}>
                  <View style={styles.linkRow}>
                    <Art name={link.art} size={28} />
                    <Text style={styles.linkLabel}>{link.label}</Text>
                    {/* The art set has no chevron; Phosphor stays for neutral
                        affordances like this, where flat is the right register. */}
                    <PopIcon name="chevron" size={20} color={theme.colors.inkMuted} />
                  </View>
                </PopSurface>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const useStyles = createThemedStyles((theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.colors.paper },
    safe: { flex: 1 },
    headerRow: {
      paddingHorizontal: spacing.lg,
      marginTop: spacing.sm,
    },
    pageTitle: { ...typography.title, color: theme.colors.headingGreen },
    content: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.xl,
      gap: spacing.md,
      width: '100%',
      maxWidth: 620,
      alignSelf: 'center',
    },
    identity: { alignItems: 'center', gap: spacing.xs },
    name: { ...typography.title, color: theme.colors.ink },
    statRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg },
    stat: { flex: 1, alignItems: 'center', gap: 4 },
    statDivider: { width: 1, height: 44, backgroundColor: 'rgba(90, 62, 24, 0.14)' },
    statValue: { ...typography.title, fontSize: 30, color: theme.colors.ink },
    statLabel: { ...typography.label, fontSize: 11, color: theme.colors.inkMuted },
    links: { gap: spacing.md },
    linkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
    linkLabel: { ...typography.heading, fontSize: 18, color: theme.colors.ink, flex: 1 },
  }),
);
