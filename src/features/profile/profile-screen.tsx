import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getProgressRepository, type PuzzleProgressSummary } from '@/data';
import { colors, radii, spacing, typography } from '@/shared/theme';
import { PopIcon, PopSurface, type PopIconName } from '@/shared/ui';

/**
 * There is no accounts system yet (Phase 2). Every player is shown the same
 * placeholder identity rather than a fabricated name or email address.
 */
const PLACEHOLDER_NAME = 'Player';

export function ProfileScreen() {
  const router = useRouter();
  const [completed, setCompleted] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const rows = await (
          await getProgressRepository()
        )
          .listSummaries()
          .catch(() => [] as PuzzleProgressSummary[]);
        if (active) setCompleted(rows.filter((r) => r.status === 'completed').length);
      })();
      return () => {
        active = false;
      };
    }, []),
  );

  const links: { icon: PopIconName; label: string; onPress: () => void }[] = [
    { icon: 'trophy', label: 'Achievements', onPress: () => router.push('/achievements') },
    { icon: 'coin', label: 'Shop', onPress: () => router.push('/shop') },
    { icon: 'chart', label: 'Statistics', onPress: () => router.push('/statistics') },
    { icon: 'gear', label: 'Settings', onPress: () => router.push('/settings') },
  ];

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.headerRow}>
          <Text style={styles.pageTitle}>Profile</Text>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.identity}>
            <PopSurface fill={colors.blossom} radius={radii.pill} style={styles.avatar}>
              <View style={styles.avatarInner}>
                <PopIcon name="profile" size={54} color={colors.ink} />
              </View>
            </PopSurface>
            <Text style={styles.name}>{PLACEHOLDER_NAME}</Text>
          </View>

          <PopSurface fill={colors.surface} radius={radii.lg}>
            <View style={styles.stats}>
              <Text style={styles.statValue}>{completed}</Text>
              <Text style={styles.statLabel}>PUZZLES COMPLETED</Text>
            </View>
          </PopSurface>

          <View style={styles.links}>
            {links.map((link) => (
              <Pressable key={link.label} accessibilityRole="button" onPress={link.onPress}>
                <PopSurface fill={colors.surface} radius={radii.md}>
                  <View style={styles.linkRow}>
                    <PopIcon name={link.icon} size={24} color={colors.berry} />
                    <Text style={styles.linkLabel}>{link.label}</Text>
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
  pageTitle: { ...typography.title, color: colors.ink },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
  },
  identity: { alignItems: 'center', gap: spacing.xs },
  avatar: { width: 96, height: 96 },
  avatarInner: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.md },
  name: { ...typography.title, color: colors.ink, marginTop: spacing.sm },
  stats: { alignItems: 'center', gap: 4, padding: spacing.lg },
  statValue: { ...typography.title, fontSize: 32, color: colors.ink },
  statLabel: { ...typography.label, fontSize: 11, color: colors.inkMuted },
  links: { gap: spacing.md },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  linkLabel: { ...typography.heading, fontSize: 18, color: colors.ink, flex: 1 },
});
