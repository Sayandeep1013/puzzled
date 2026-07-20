import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radii, spacing } from '@/shared/theme';

export function HomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>YOUR QUIET CORNER</Text>
          <Text style={styles.title}>Puzzled</Text>
          <Text style={styles.subtitle}>
            Slow down, find the edges, and make the picture whole.
          </Text>
        </View>

        <View style={styles.progressCard}>
          <View style={styles.progressCopy}>
            <Text style={styles.cardLabel}>THIS WEEK</Text>
            <Text style={styles.progressValue}>0 pieces placed</Text>
            <Text style={styles.cardDescription}>
              Progress will be stored on this device, even when you are offline.
            </Text>
          </View>
          <View style={styles.progressRing}>
            <Text style={styles.progressPercent}>0%</Text>
          </View>
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Ready to play?</Text>
          <Text style={styles.sectionMeta}>4 × 4 · 16 pieces</Text>
        </View>

        <View style={styles.puzzleCard}>
          <View style={styles.preview}>
            <View style={[styles.previewTile, styles.previewTileOne]} />
            <View style={[styles.previewTile, styles.previewTileTwo]} />
            <View style={[styles.previewTile, styles.previewTileThree]} />
            <Text style={styles.previewLabel}>Sample puzzle</Text>
          </View>
          <View style={styles.puzzleDetails}>
            <View>
              <Text style={styles.puzzleTitle}>First Light</Text>
              <Text style={styles.puzzleMeta}>Starter 4×4 · Drag & snap</Text>
            </View>
            <Link
              href={{ pathname: '/game/[puzzleId]', params: { puzzleId: 'first-light' } }}
              asChild
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Start First Light puzzle"
                style={({ pressed }) => [styles.playButton, pressed && styles.playButtonPressed]}
              >
                <Text style={styles.playButtonText}>Start puzzle</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  content: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    gap: spacing.xl,
  },
  heading: {
    gap: spacing.sm,
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
  title: {
    color: colors.ink,
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -1.5,
  },
  subtitle: {
    maxWidth: 500,
    color: colors.inkMuted,
    fontSize: 17,
    lineHeight: 25,
  },
  progressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.sage,
  },
  progressCopy: {
    flex: 1,
    gap: spacing.sm,
  },
  cardLabel: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  progressValue: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '800',
  },
  cardDescription: {
    maxWidth: 430,
    color: colors.inkMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  progressRing: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 7,
    borderColor: colors.surfaceStrong,
    borderRadius: radii.pill,
  },
  progressPercent: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: '800',
  },
  sectionMeta: {
    color: colors.inkMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  puzzleCard: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
  },
  preview: {
    height: 210,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    padding: spacing.lg,
    backgroundColor: '#F4C78D',
  },
  previewTile: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: radii.pill,
  },
  previewTileOne: {
    top: -70,
    left: -20,
    backgroundColor: '#E88962',
  },
  previewTileTwo: {
    top: 20,
    right: -30,
    backgroundColor: '#759A88',
  },
  previewTileThree: {
    bottom: -110,
    left: 110,
    backgroundColor: '#F8E6B9',
  },
  previewLabel: {
    color: colors.surfaceStrong,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  puzzleDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    padding: spacing.lg,
  },
  puzzleTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '800',
  },
  puzzleMeta: {
    marginTop: spacing.xs,
    color: colors.inkMuted,
    fontSize: 13,
  },
  playButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 13,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
  },
  playButtonPressed: {
    backgroundColor: colors.accentPressed,
  },
  playButtonText: {
    color: colors.surfaceStrong,
    fontSize: 14,
    fontWeight: '800',
  },
});
