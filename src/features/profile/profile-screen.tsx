import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getProgressRepository, type PuzzleProgressSummary } from '@/data';
import { colors, radii, spacing, typography } from '@/shared/theme';
import { PaperBackground, SketchFrame, SketchIcon, type IconName } from '@/shared/ui';

export function ProfileScreen() {
  const router = useRouter();
  const [completed, setCompleted] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const rows = await (await getProgressRepository())
          .listSummaries()
          .catch(() => [] as PuzzleProgressSummary[]);
        if (active) setCompleted(rows.filter((r) => r.status === 'completed').length);
      })();
      return () => {
        active = false;
      };
    }, []),
  );

  const soon = (label: string) => Alert.alert(label, 'Coming soon in the redesign.');

  const links: { icon: IconName; label: string; onPress: () => void }[] = [
    { icon: 'trophy', label: 'Achievements', onPress: () => router.push('/achievements') },
    { icon: 'coin', label: 'Shop', onPress: () => router.push('/shop') },
    { icon: 'chart', label: 'Statistics', onPress: () => soon('Statistics') },
    { icon: 'gear', label: 'Settings', onPress: () => soon('Settings') },
    { icon: 'help', label: 'Help & Support', onPress: () => soon('Help & Support') },
  ];

  return (
    <PaperBackground>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.headerRow}>
          <Text style={styles.pageTitle}>Profile</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Edit profile" onPress={() => soon('Edit profile')}>
            <SketchIcon name="edit" size={22} color={colors.primary} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.identity}>
            <SketchFrame fill={colors.rose} radius={radii.pill} seed={64} style={styles.avatar}>
              <View style={styles.avatarInner}>
                <SketchIcon name="profile" size={54} color={colors.inkSoft} />
              </View>
            </SketchFrame>
            <Text style={styles.name}>Puzzle Master</Text>
            <Text style={styles.handle}>puzzlemaster@mail.com</Text>
          </View>

          <SketchFrame fill={colors.surface} radius={radii.lg} seed={7}>
            <View style={styles.stats}>
              <Stat label="COMPLETED" value={String(completed)} />
              <View style={styles.statDivider} />
              <Stat label="BEST TIME" value="08:16" />
              <View style={styles.statDivider} />
              <Stat label="TOTAL TIME" value="24h" />
            </View>
          </SketchFrame>

          <View style={styles.links}>
            {links.map((link) => (
              <Pressable key={link.label} accessibilityRole="button" onPress={link.onPress}>
                <SketchFrame fill={colors.surface} radius={radii.md} seed={link.label.length * 8 + 3}>
                  <View style={styles.linkRow}>
                    <SketchIcon name={link.icon} size={24} color={colors.primary} />
                    <Text style={styles.linkLabel}>{link.label}</Text>
                    <SketchIcon name="chevron" size={20} color={colors.inkMuted} />
                  </View>
                </SketchFrame>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </PaperBackground>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  handle: { ...typography.caption, color: colors.inkMuted },
  stats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', padding: spacing.lg },
  stat: { alignItems: 'center', gap: 4, flex: 1 },
  statValue: { ...typography.title, fontSize: 26, color: colors.ink },
  statLabel: { ...typography.label, fontSize: 10, color: colors.inkMuted },
  statDivider: { width: 2, height: 36, backgroundColor: colors.line },
  links: { gap: spacing.md },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  linkLabel: { ...typography.heading, fontSize: 18, color: colors.ink, flex: 1 },
});
