import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getProgressRepository, type PuzzleProgressSummary } from '@/data';
import { colors, radii, spacing, typography } from '@/shared/theme';
import { type ArtName } from '@/shared/art';
import { Art, PopIcon, PopSurface, useTabBarSpace } from '@/shared/ui';

/**
 * There is no accounts system yet (Phase 2). Every player is shown the same
 * placeholder identity rather than a fabricated name or email address.
 */
const PLACEHOLDER_NAME = 'Player';

export function ProfileScreen() {
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
        if (active) {
          setCompleted(rows.filter((r) => r.status === 'completed').length);
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
    { art: 'coin', label: 'Shop', onPress: () => router.push('/shop') },
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
          <PopSurface fill={colors.surface} radius={radii.lg}>
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
                <PopSurface fill={colors.surface} radius={radii.md}>
                  <View style={styles.linkRow}>
                    <Art name={link.art} size={28} />
                    <Text style={styles.linkLabel}>{link.label}</Text>
                    {/* The art set has no chevron; Phosphor stays for neutral
                        affordances like this, where flat is the right register. */}
                    <PopIcon name="chevron" size={20} color={colors.inkMuted} />
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  safe: { flex: 1 },
  headerRow: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  pageTitle: { ...typography.title, color: colors.headingGreen },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
  },
  identity: { alignItems: 'center', gap: spacing.xs },
  name: { ...typography.title, color: colors.ink, marginTop: spacing.sm },
  statRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg },
  stat: { flex: 1, alignItems: 'center', gap: 4 },
  statDivider: { width: 1, height: 44, backgroundColor: 'rgba(90, 62, 24, 0.14)' },
  statValue: { ...typography.title, fontSize: 30, color: colors.ink },
  statLabel: { ...typography.label, fontSize: 11, color: colors.inkMuted },
  links: { gap: spacing.md },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  linkLabel: { ...typography.heading, fontSize: 18, color: colors.ink, flex: 1 },
});
