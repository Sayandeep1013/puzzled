import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listCatalog, resolvePuzzleImageSource } from '@/data';
import { type PuzzleDefinition } from '@/game-engine';
import { colors, radii, spacing, typography } from '@/shared/theme';
import { PaperBackground, SketchFrame, SketchIcon, type IconName } from '@/shared/ui';

const CATEGORIES: { key: string; label: string; icon: IconName; tint: string }[] = [
  { key: 'nature', label: 'Nature', icon: 'leaf', tint: colors.sage },
  { key: 'animals', label: 'Animals', icon: 'paw', tint: colors.rose },
  { key: 'cities', label: 'Cities', icon: 'city', tint: colors.primary },
  { key: 'art', label: 'Art', icon: 'palette', tint: colors.gold },
  { key: 'food', label: 'Food', icon: 'food', tint: colors.accent },
];

function imageFor(puzzle: PuzzleDefinition): number | string | null {
  return resolvePuzzleImageSource(puzzle);
}

export function ExploreScreen() {
  const router = useRouter();
  const [puzzles, setPuzzles] = useState<PuzzleDefinition[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      listCatalog().then(({ bundled, user }) => {
        if (active) setPuzzles([...bundled, ...user]);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const open = (puzzle: PuzzleDefinition) =>
    router.push({ pathname: '/difficulty/[puzzleId]', params: { puzzleId: puzzle.id } });

  const recommended = puzzles[0];
  const popular = puzzles.slice(1);

  return (
    <PaperBackground>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.pageTitle}>Explore</Text>

          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Categories</Text>
            <Text style={styles.seeAll}>See all</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.catRow}
          >
            {CATEGORIES.map((cat) => (
              <View key={cat.key} style={styles.cat}>
                <SketchFrame fill={cat.tint} radius={20} seed={cat.key.length * 9 + 4}>
                  <View style={styles.catInner}>
                    <SketchIcon name={cat.icon} size={30} color={colors.inkSoft} />
                  </View>
                </SketchFrame>
                <Text style={styles.catLabel}>{cat.label}</Text>
              </View>
            ))}
          </ScrollView>

          {recommended ? (
            <>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>Recommended</Text>
              </View>
              <Pressable onPress={() => open(recommended)} accessibilityRole="button">
                <SketchFrame fill={colors.surface} radius={radii.lg} seed={21}>
                  <View style={styles.featureBody}>
                    <View style={styles.featureImageWrap}>
                      <Preview puzzle={recommended} />
                      <View style={styles.newTag}>
                        <Text style={styles.newTagText}>NEW</Text>
                      </View>
                    </View>
                    <View style={styles.featureCopy}>
                      <Text style={styles.featureTitle} numberOfLines={1}>
                        {recommended.title}
                      </Text>
                      <Text style={styles.featureMeta}>Tap to choose a difficulty</Text>
                    </View>
                  </View>
                </SketchFrame>
              </Pressable>
            </>
          ) : null}

          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Popular puzzles</Text>
            <Text style={styles.seeAll}>See all</Text>
          </View>
          <View style={styles.grid}>
            {popular.map((puzzle) => (
              <Pressable
                key={puzzle.id}
                onPress={() => open(puzzle)}
                accessibilityRole="button"
                style={styles.gridItem}
              >
                <SketchFrame fill={colors.surface} radius={radii.md} seed={puzzle.id.length * 5 + 2}>
                  <View style={styles.gridBody}>
                    <View style={styles.gridImageWrap}>
                      <Preview puzzle={puzzle} />
                    </View>
                    <Text style={styles.gridTitle} numberOfLines={1}>
                      {puzzle.title}
                    </Text>
                  </View>
                </SketchFrame>
              </Pressable>
            ))}
            {popular.length === 0 ? (
              <Text style={styles.empty}>Add photos from Home to see more puzzles here.</Text>
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    </PaperBackground>
  );
}

function Preview({ puzzle }: { puzzle: PuzzleDefinition }) {
  const source = imageFor(puzzle);
  if (source == null) {
    return (
      <View style={styles.previewFallback}>
        <SketchIcon name="puzzle" size={40} color={colors.inkMuted} />
      </View>
    );
  }
  return (
    <Image
      source={typeof source === 'number' ? source : { uri: source }}
      style={styles.previewImage}
      resizeMode="cover"
    />
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
  pageTitle: { ...typography.title, color: colors.ink, marginTop: spacing.sm },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  sectionTitle: { ...typography.heading, color: colors.ink },
  seeAll: { ...typography.caption, color: colors.primary },
  catRow: { gap: spacing.md, paddingVertical: spacing.xs, paddingRight: spacing.md },
  cat: { alignItems: 'center', gap: spacing.xs, width: 74 },
  catInner: { width: 62, height: 62, alignItems: 'center', justifyContent: 'center' },
  catLabel: { ...typography.caption, color: colors.ink },
  featureBody: { padding: spacing.sm, gap: spacing.sm },
  featureImageWrap: {
    height: 150,
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: colors.kraft,
  },
  featureCopy: { paddingHorizontal: spacing.xs, paddingBottom: spacing.xs, gap: 2 },
  featureTitle: { ...typography.heading, color: colors.ink },
  featureMeta: { ...typography.caption, color: colors.inkMuted },
  newTag: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  newTagText: { ...typography.label, fontSize: 10, color: colors.surfaceStrong },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'space-between' },
  gridItem: { width: '47%' },
  gridBody: { padding: spacing.sm, gap: spacing.sm },
  gridImageWrap: {
    height: 110,
    borderRadius: radii.sm,
    overflow: 'hidden',
    backgroundColor: colors.kraft,
  },
  gridTitle: { ...typography.caption, color: colors.ink, paddingHorizontal: 2 },
  previewImage: { width: '100%', height: '100%' },
  previewFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { ...typography.body, color: colors.inkMuted },
});
