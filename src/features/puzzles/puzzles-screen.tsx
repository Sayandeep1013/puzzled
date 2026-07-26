import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listCatalog, resolvePuzzleImageSource } from '@/data';
import { type PuzzleDefinition } from '@/game-engine';
import { colors, radii, spacing, typography } from '@/shared/theme';
import { PopChip, PopIcon, PopSurface } from '@/shared/ui';

/**
 * `PuzzleDefinition` has no category/tag field — just id, title, image,
 * gridSize, seed, revision (`src/game-engine/core/types.ts`). There is nothing
 * to honestly bucket into "nature/animals/cities/art/food", so those fake
 * chips are gone. The filter instead runs on the one real split the catalog
 * already makes: bundled starters vs. puzzles the player imported
 * (`listCatalog()` returns `{ bundled, user }` — the same split `HomeScreen`
 * sections its lists by).
 */
type SourceFilter = 'all' | 'bundled' | 'user';

const FILTERS: { key: SourceFilter; label: string; tone: string }[] = [
  { key: 'all', label: 'All', tone: colors.grape },
  { key: 'bundled', label: 'Starters', tone: colors.tangerine },
  { key: 'user', label: 'My Photos', tone: colors.bubblegum },
];

/** Tones used to frame grid cards, cycling independently of the filter tones above. */
const CARD_TONES = [colors.grape, colors.bubblegum, colors.tangerine, colors.mint, colors.sky];

interface CatalogData {
  bundled: PuzzleDefinition[];
  user: PuzzleDefinition[];
}

const EMPTY: CatalogData = { bundled: [], user: [] };

function imageFor(puzzle: PuzzleDefinition): number | string | null {
  return resolvePuzzleImageSource(puzzle);
}

export function PuzzlesScreen() {
  const router = useRouter();
  const [data, setData] = useState<CatalogData>(EMPTY);
  const [filter, setFilter] = useState<SourceFilter>('all');

  useFocusEffect(
    useCallback(() => {
      let active = true;
      listCatalog().then(({ bundled, user }) => {
        if (active) setData({ bundled, user });
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const filtered = useMemo(() => {
    if (filter === 'bundled') return data.bundled;
    if (filter === 'user') return data.user;
    return [...data.bundled, ...data.user];
  }, [data, filter]);

  const open = (puzzle: PuzzleDefinition) =>
    router.push({ pathname: '/difficulty/[puzzleId]', params: { puzzleId: puzzle.id } });

  const recommended = filtered[0];
  const rest = filtered.slice(1);

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.pageTitle}>Puzzles</Text>

          <Pressable
            onPress={() =>
              router.push({ pathname: '/pack/[packId]', params: { packId: 'starter' } })
            }
            accessibilityRole="button"
            accessibilityLabel="Browse the Starter Pack"
          >
            <PopSurface fill={colors.sunshine} radius={radii.md} contentStyle={styles.packFrame}>
              <View style={styles.packBody}>
                <PopIcon name="packs" size={26} color={colors.ink} />
                <View style={styles.packCopy}>
                  <Text style={styles.packTitle}>Starter Pack</Text>
                  <Text style={styles.packMeta}>Every puzzle bundled with Puzzled</Text>
                </View>
                <PopIcon name="chevron" size={20} color={colors.inkMuted} />
              </View>
            </PopSurface>
          </Pressable>

          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Browse</Text>
            {/* "See all" clears the current filter — a real action, not a dead link. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear filter and show every puzzle"
              onPress={() => setFilter('all')}
            >
              <Text style={styles.seeAll}>See all</Text>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {FILTERS.map((item) => (
              <PopChip
                key={item.key}
                label={item.label}
                tone={item.tone}
                selected={filter === item.key}
                onPress={() => setFilter(item.key)}
              />
            ))}
          </ScrollView>

          {recommended ? (
            <>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>Recommended</Text>
              </View>
              <Pressable onPress={() => open(recommended)} accessibilityRole="button">
                <PopSurface
                  fill={colors.tangerine}
                  radius={radii.lg}
                  contentStyle={styles.featureFrame}
                >
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
                </PopSurface>
              </Pressable>
            </>
          ) : null}

          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>All puzzles</Text>
            <Text style={styles.sectionMeta}>
              {filtered.length} {filtered.length === 1 ? 'puzzle' : 'puzzles'}
            </Text>
          </View>
          <View style={styles.grid}>
            {rest.map((puzzle, index) => (
              <Pressable
                key={puzzle.id}
                onPress={() => open(puzzle)}
                accessibilityRole="button"
                style={styles.gridItem}
              >
                <PopSurface
                  fill={CARD_TONES[index % CARD_TONES.length]}
                  radius={radii.md}
                  contentStyle={styles.gridFrame}
                >
                  <View style={styles.gridBody}>
                    <View style={styles.gridImageWrap}>
                      <Preview puzzle={puzzle} />
                    </View>
                    <Text style={styles.gridTitle} numberOfLines={1}>
                      {puzzle.title}
                    </Text>
                  </View>
                </PopSurface>
              </Pressable>
            ))}
            {filtered.length === 0 ? (
              <Text style={styles.empty}>
                {filter === 'user'
                  ? 'Add photos from Home to see them here.'
                  : 'No puzzles to show yet.'}
              </Text>
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Preview({ puzzle }: { puzzle: PuzzleDefinition }) {
  const source = imageFor(puzzle);
  if (source == null) {
    return (
      <View style={styles.previewFallback}>
        <PopIcon name="puzzle" size={40} color={colors.inkMuted} />
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
  pageTitle: { ...typography.title, color: colors.ink, marginTop: spacing.sm },
  // Inset padding on the coloured `PopSurface` face, so a ring of `fill` shows
  // as a frame around the white row body nested inside it (the
  // `pack-screen.tsx` row / `home-screen.tsx` `PuzzleCard` pattern).
  packFrame: { padding: spacing.xs },
  packBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
  },
  packCopy: { flex: 1, gap: 2 },
  packTitle: { ...typography.heading, fontSize: 17, color: colors.ink },
  packMeta: { ...typography.caption, color: colors.inkMuted },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  sectionTitle: { ...typography.heading, color: colors.ink },
  sectionMeta: { ...typography.caption, color: colors.inkMuted },
  seeAll: { ...typography.caption, color: colors.grape },
  chipRow: { gap: spacing.sm, paddingVertical: spacing.xs, paddingRight: spacing.md },
  // Inset padding on the coloured `PopSurface` face, so a ring of `fill` shows
  // as a frame around the white card body nested inside it (see HomeScreen's
  // `PuzzleCard` — ink-on-saturated-fill body text fails contrast).
  featureFrame: { padding: spacing.xs },
  featureBody: { overflow: 'hidden', borderRadius: radii.md, backgroundColor: colors.surface },
  featureImageWrap: {
    height: 150,
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: colors.sunshine,
  },
  featureCopy: { padding: spacing.md, gap: 2 },
  featureTitle: { ...typography.heading, color: colors.ink },
  featureMeta: { ...typography.caption, color: colors.inkMuted },
  newTag: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: colors.cherry,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  newTagText: { ...typography.label, fontSize: 10, color: colors.onFill },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  gridItem: { width: '47%' },
  gridFrame: { padding: spacing.xs },
  gridBody: { overflow: 'hidden', borderRadius: radii.sm, backgroundColor: colors.surface },
  gridImageWrap: {
    height: 110,
    borderRadius: radii.sm,
    overflow: 'hidden',
    backgroundColor: colors.sunshine,
  },
  gridTitle: { ...typography.caption, color: colors.ink, padding: spacing.sm },
  previewImage: { width: '100%', height: '100%' },
  previewFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { ...typography.body, color: colors.inkMuted },
});
