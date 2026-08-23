import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getProgressRepository,
  listCatalog,
  resolvePuzzleImageSource,
  type PuzzleProgressSummary,
} from '@/data';
import { type PuzzleDefinition } from '@/game-engine';
import { radii, spacing, typography } from '@/shared/theme';
import { useTheme } from '@/shared/theme-context';
import { type ThemePalette } from '@/shared/themes';
import { createThemedStyles } from '@/shared/themed-styles';
import {
  Art,
  PopButton,
  PopChip,
  PopIcon,
  PopSurface,
  Text,
  useTabBarSpace,
  ThemeGround,
} from '@/shared/ui';

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

/**
 * Tones are palette *keys*, not hex values.
 *
 * A table of hex built at module scope is built once, against whichever palette
 * was loaded when the file was first evaluated — so it would keep the meadow's
 * greens after a theme change. Naming the slot instead lets each render resolve
 * it against the active theme, and the key is checked by the compiler.
 */
const FILTERS: { key: SourceFilter; label: string; tone: keyof ThemePalette }[] = [
  { key: 'all', label: 'All', tone: 'grass' },
  { key: 'bundled', label: 'Starters', tone: 'apricot' },
  { key: 'user', label: 'My Photos', tone: 'blossom' },
];

interface CatalogData {
  bundled: PuzzleDefinition[];
  user: PuzzleDefinition[];
  /** Saved sessions per puzzle, most recently played first. */
  byPuzzle: Record<string, PuzzleProgressSummary[]>;
}

const EMPTY: CatalogData = { bundled: [], user: [], byPuzzle: {} };

function imageFor(puzzle: PuzzleDefinition): number | string | null {
  return resolvePuzzleImageSource(puzzle);
}

export function PuzzlesScreen() {
  const theme = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const [data, setData] = useState<CatalogData>(EMPTY);
  const [filter, setFilter] = useState<SourceFilter>('all');
  const tabBarSpace = useTabBarSpace();

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const { bundled, user } = await listCatalog();

        // Progress powers the Continue/Start distinction this screen inherited
        // from Home, so it is loaded here rather than on the landing screen.
        const byPuzzle: Record<string, PuzzleProgressSummary[]> = {};
        try {
          const rows = await (await getProgressRepository()).listSummaries();
          for (const row of rows) {
            (byPuzzle[row.puzzleId] ??= []).push(row);
          }
        } catch {
          // Progress is best-effort; an unreadable database still lists puzzles.
        }

        if (active) setData({ bundled, user, byPuzzle });
      })();
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

  /** Resume straight into the last size played; otherwise pick a difficulty. */
  const play = (puzzle: PuzzleDefinition) => {
    const latest = data.byPuzzle[puzzle.id]?.[0];
    if (latest != null && latest.lockedPieces > 0) {
      router.push({
        pathname: '/game/[puzzleId]',
        params: { puzzleId: puzzle.id, size: String(latest.gridSize) },
      });
      return;
    }
    open(puzzle);
  };

  const recommended = filtered[0];

  return (
    <View style={styles.root}>
      <ThemeGround />
      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* The scroll frame stops above the floating dock rather than running
            under it. Content sliding beneath a bar that does not span the full
            width reads as two overlapping layers. */}
        <View style={[styles.scrollFrame, { paddingBottom: tabBarSpace }]}>
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.pageTitle}>Puzzles</Text>

            <Pressable
              onPress={() =>
                router.push({ pathname: '/pack/[packId]', params: { packId: 'starter' } })
              }
              accessibilityRole="button"
              accessibilityLabel="Browse the Starter Pack"
            >
              <PopSurface
                fill={theme.colors.honey}
                radius={radii.md}
                contentStyle={styles.packFrame}
              >
                <View style={styles.packBody}>
                  <Art name="collection" size={30} />
                  <View style={styles.packCopy}>
                    <Text style={styles.packTitle}>Starter Pack</Text>
                    <Text style={styles.packMeta}>Every puzzle bundled with Puzzled</Text>
                  </View>
                  <PopIcon name="chevron" size={20} color={theme.colors.inkMuted} />
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
                  tone={theme.colors[item.tone]}
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
                    fill={theme.colors.apricot}
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
              <Text style={styles.sectionTitle}>Ready to play?</Text>
              <Text style={styles.sectionMeta}>
                {filtered.length} {filtered.length === 1 ? 'puzzle' : 'puzzles'}
              </Text>
            </View>
            {/* Every filtered puzzle, not `slice(1)`. Excluding the recommended one
              meant a single-puzzle catalog rendered a header reading "1 puzzle"
              above an empty grid. The Recommended card is a second presentation
              of the same puzzle, which is normal. */}
            <View style={styles.list}>
              {filtered.map((puzzle) => (
                <StarterRow
                  key={puzzle.id}
                  puzzle={puzzle}
                  rows={data.byPuzzle[puzzle.id] ?? []}
                  onPress={() => play(puzzle)}
                />
              ))}
              {filtered.length === 0 ? (
                <Text style={styles.empty}>
                  {filter === 'user'
                    ? 'Import a photo from Library to see it here.'
                    : 'No puzzles to show yet.'}
                </Text>
              ) : null}
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </View>
  );
}

/**
 * A playable puzzle with its progress — the card Home used to own.
 *
 * The old Home version passed a `previewUri` only for imported photos, so
 * bundled puzzles fell through to decorative coloured blobs even though their
 * artwork exists. This resolves every puzzle through `resolvePuzzleImageSource`,
 * the same path the Recommended card already used correctly.
 */
function StarterRow({
  puzzle,
  rows,
  onPress,
}: {
  puzzle: PuzzleDefinition;
  rows: PuzzleProgressSummary[];
  onPress: () => void;
}) {
  const theme = useTheme();
  const styles = useStyles();
  const latest = rows[0];
  const done = latest?.status === 'completed';
  const started = latest != null && latest.lockedPieces > 0;

  return (
    <PopSurface fill={theme.colors.surface} radius={radii.lg} contentStyle={styles.rowBody}>
      <View style={styles.rowThumb}>
        <Preview puzzle={puzzle} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {puzzle.title}
        </Text>
        <Text style={styles.rowMeta}>
          {started
            ? `${latest.gridSize}×${latest.gridSize} · ${latest.lockedPieces}/${latest.totalPieces} placed`
            : 'Choose 3×3 up to 10×10'}
          {rows.length > 1 ? ` · ${rows.length} sizes` : ''}
        </Text>
      </View>
      <PopButton
        label={done ? 'Again' : started ? 'Continue' : 'Start'}
        tone="grass"
        size="sm"
        accessibilityLabel={`${done ? 'Play again' : started ? 'Continue' : 'Start'} ${puzzle.title}`}
        onPress={onPress}
      />
    </PopSurface>
  );
}

function Preview({ puzzle }: { puzzle: PuzzleDefinition }) {
  const styles = useStyles();
  const source = imageFor(puzzle);
  if (source == null) {
    return (
      <View style={styles.previewFallback}>
        <Art name="puzzle-quad" size={44} />
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

const useStyles = createThemedStyles((theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.colors.paper },
    /** Ends where the dock begins, so nothing scrolls underneath it. */
    scrollFrame: { flex: 1 },
    safe: { flex: 1 },
    content: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.xl,
      gap: spacing.md,
      width: '100%',
      maxWidth: 720,
      alignSelf: 'center',
    },
    pageTitle: { ...typography.title, color: theme.colors.headingGreen },
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
      backgroundColor: theme.colors.surface,
    },
    packCopy: { flex: 1, gap: 2 },
    packTitle: { ...typography.heading, fontSize: 17, color: theme.colors.ink },
    packMeta: { ...typography.caption, color: theme.colors.inkMuted },
    sectionHead: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginTop: spacing.sm,
    },
    sectionTitle: { ...typography.heading, color: theme.colors.ink },
    sectionMeta: { ...typography.caption, color: theme.colors.inkMuted },
    seeAll: { ...typography.caption, color: theme.colors.headingGreen },
    chipRow: { gap: spacing.sm, paddingVertical: spacing.xs, paddingRight: spacing.md },
    // Inset padding on the coloured `PopSurface` face, so a ring of `fill` shows
    // as a frame around the white card body nested inside it (see HomeScreen's
    // `PuzzleCard` — ink-on-saturated-fill body text fails contrast).
    featureFrame: { padding: spacing.xs },
    featureBody: {
      overflow: 'hidden',
      borderRadius: radii.md,
      backgroundColor: theme.colors.surface,
    },
    featureImageWrap: {
      height: 150,
      borderRadius: radii.md,
      overflow: 'hidden',
      backgroundColor: theme.colors.honey,
    },
    featureCopy: { padding: spacing.md, gap: 2 },
    featureTitle: { ...typography.heading, color: theme.colors.ink },
    featureMeta: { ...typography.caption, color: theme.colors.inkMuted },
    newTag: {
      position: 'absolute',
      top: spacing.sm,
      right: spacing.sm,
      backgroundColor: theme.colors.cherry,
      borderRadius: radii.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
    },
    newTagText: { ...typography.label, fontSize: 10, color: theme.colors.onFill },
    list: { gap: spacing.md },
    rowBody: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
    },
    rowThumb: {
      width: 68,
      height: 68,
      borderRadius: radii.sm,
      overflow: 'hidden',
      backgroundColor: theme.colors.paper,
    },
    rowCopy: { flex: 1, gap: 2 },
    rowTitle: { ...typography.heading, fontSize: 17, color: theme.colors.ink },
    rowMeta: { ...typography.caption, color: theme.colors.inkMuted },
    previewImage: { width: '100%', height: '100%' },
    previewFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    empty: { ...typography.body, color: theme.colors.inkMuted },
  }),
);
