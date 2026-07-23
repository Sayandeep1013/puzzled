import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radii, spacing, typography } from '@/shared/theme';
import { PaperBackground, ScreenHeader, SketchFrame, SketchIcon, type IconName } from '@/shared/ui';

interface Achievement {
  icon: IconName;
  tint: string;
  title: string;
  desc: string;
  current: number;
  goal: number;
}

const ACHIEVEMENTS: Achievement[] = [
  { icon: 'check', tint: colors.sage, title: 'First Puzzle', desc: 'Complete your first puzzle', current: 1, goal: 1 },
  { icon: 'sparkle', tint: colors.gold, title: 'Speed Master', desc: 'Finish in under 10 minutes', current: 8, goal: 10 },
  { icon: 'puzzle', tint: colors.primary, title: 'Puzzle Collector', desc: 'Complete 50 puzzles', current: 26, goal: 50 },
  { icon: 'medal', tint: colors.rose, title: 'Hard Worker', desc: 'Complete 10 hard puzzles', current: 6, goal: 10 },
  { icon: 'star', tint: colors.primary, title: 'Perfectionist', desc: 'Use fewer than 3 hints', current: 5, goal: 5 },
  { icon: 'calendar', tint: colors.accent, title: 'Daily Player', desc: 'Play puzzles for 7 days', current: 5, goal: 7 },
];

export function AchievementsScreen() {
  return (
    <PaperBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScreenHeader title="Achievements" />
        <ScrollView contentContainerStyle={styles.content}>
          {ACHIEVEMENTS.map((a) => {
            const done = a.current >= a.goal;
            const pct = Math.round((Math.min(a.current, a.goal) / a.goal) * 100);
            return (
              <SketchFrame key={a.title} fill={colors.surface} radius={radii.md} seed={a.title.length * 7 + 1}>
                <View style={styles.row}>
                  <SketchFrame fill={a.tint} radius={radii.sm} seed={a.title.length * 3 + 5}>
                    <View style={styles.badge}>
                      <SketchIcon name={a.icon} size={26} color={colors.inkSoft} />
                    </View>
                  </SketchFrame>
                  <View style={styles.body}>
                    <Text style={styles.title}>{a.title}</Text>
                    <Text style={styles.desc}>{a.desc}</Text>
                    <View style={styles.track}>
                      <View style={[styles.fill, { width: `${pct}%` }]} />
                    </View>
                  </View>
                  <View style={styles.trailing}>
                    {done ? (
                      <SketchIcon name="check" size={22} color={colors.sage} />
                    ) : (
                      <Text style={styles.count}>
                        {a.current}/{a.goal}
                      </Text>
                    )}
                  </View>
                </View>
              </SketchFrame>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  badge: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 4 },
  title: { ...typography.heading, fontSize: 18, color: colors.ink },
  desc: { ...typography.caption, color: colors.inkMuted },
  track: {
    height: 7,
    borderRadius: radii.pill,
    backgroundColor: colors.kraft,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
    marginTop: 2,
  },
  fill: { height: '100%', backgroundColor: colors.gold },
  trailing: { minWidth: 42, alignItems: 'flex-end' },
  count: { ...typography.bodyStrong, fontSize: 13, color: colors.inkMuted },
});
