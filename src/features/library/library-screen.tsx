import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getFavouritesRepository,
  getProgressRepository,
  listCatalog,
  resolvePuzzleImageSource,
  type PuzzleProgressSummary,
} from '@/data';
import { type PuzzleDefinition } from '@/game-engine';
import { accentAt, colors, radii, spacing, typography } from '@/shared/theme';
import { PopChip, PopIcon, PopProgress, PopSurface, type PopIconName } from '@/shared/ui';

type Tab = 'progress' | 'completed' | 'favourites' | 'photos';

const TABS: { key: Tab; label: string }[] = [
  { key: 'progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
  { key: 'favourites', label: 'Favourites' },
  { key: 'photos', label: 'My Photos' },
];

const EMPTY_COPY: Record<Tab, { icon: PopIconName; text: string; sub: string }> = {
  progress: {
    icon: 'library',
    text: 'Nothing in progress',
    sub: 'Start a puzzle from Home or Puzzles.',
  },
  completed: {
    icon: 'library',
    text: 'No completed puzzles yet',
    sub: 'Finish a puzzle to see it here.',
  },
  favourites: {
    icon: 'heart',
    text: 'No favourites yet',
    sub: 'Tap the heart on a puzzle to save it here.',
  },
  photos: {
    icon: 'library',
    text: 'No photos yet',
    sub: 'Import a photo from Home to see it here.',
  },
};

/** One row's worth of joined data: a puzzle plus its (optional) saved progress. */
interface VisibleItem {
  puzzleId: string;
  puzzle?: PuzzleDefinition;
  progress?: PuzzleProgressSummary;
}

interface LibraryData {
  /** Every saved session, most recently played first (mirrors HomeScreen's loader). */
  rows: (PuzzleProgressSummary & { puzzle?: PuzzleDefinition })[];
  /** Sessions grouped per puzzle id, so Favourites/Photos can show the latest one. */
  byPuzzle: Record<string, PuzzleProgressSummary[]>;
  catalogById: Map<string, PuzzleDefinition>;
  userPuzzles: PuzzleDefinition[];
  favouriteIds: Set<string>;
}

const EMPTY_DATA: LibraryData = {
  rows: [],
  byPuzzle: {},
  catalogById: new Map(),
  userPuzzles: [],
  favouriteIds: new Set(),
};

async function loadLibraryData(): Promise<LibraryData> {
  const [{ bundled, user }, summaries, favouriteIds] = await Promise.all([
    listCatalog(),
    (await getProgressRepository()).listSummaries().catch(() => [] as PuzzleProgressSummary[]),
    (await getFavouritesRepository()).list().catch(() => [] as string[]),
  ]);

  const catalogById = new Map<string, PuzzleDefinition>();
  for (const puzzle of [...bundled, ...user]) catalogById.set(puzzle.id, puzzle);

  const byPuzzle: Record<string, PuzzleProgressSummary[]> = {};
  for (const row of summaries) {
    (byPuzzle[row.puzzleId] ??= []).push(row);
  }

  return {
    rows: summaries.map((s) => ({ ...s, puzzle: catalogById.get(s.puzzleId) })),
    byPuzzle,
    catalogById,
    userPuzzles: user,
    favouriteIds: new Set(favouriteIds),
  };
}

export function LibraryScreen() {
  const [tab, setTab] = useState<Tab>('progress');
  const [data, setData] = useState<LibraryData>(EMPTY_DATA);

  // Refetch on focus so progress, favourites, and imported photos reflect
  // whatever changed on the board or on Home since this screen last showed.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadLibraryData().then((next) => {
        if (active) setData(next);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const onToggleFavourite = useCallback(async (puzzleId: string) => {
    const isFavourite = await (await getFavouritesRepository()).toggle(puzzleId);
    // Optimistic local update — a full refetch also happens next time this
    // screen gains focus, but the Favourites tab should react immediately.
    setData((prev) => {
      const favouriteIds = new Set(prev.favouriteIds);
      if (isFavourite) {
        favouriteIds.add(puzzleId);
      } else {
        favouriteIds.delete(puzzleId);
      }
      return { ...prev, favouriteIds };
    });
  }, []);

  const inProgress = data.rows.filter((r) => r.status !== 'completed' && r.lockedPieces > 0);
  const completed = data.rows.filter((r) => r.status === 'completed');
  const favouritePuzzles = Array.from(data.favouriteIds)
    .map((id) => data.catalogById.get(id))
    .filter((puzzle): puzzle is PuzzleDefinition => puzzle != null);

  const visible: VisibleItem[] =
    tab === 'progress'
      ? inProgress.map((row) => ({ puzzleId: row.puzzleId, puzzle: row.puzzle, progress: row }))
      : tab === 'completed'
        ? completed.map((row) => ({ puzzleId: row.puzzleId, puzzle: row.puzzle, progress: row }))
        : tab === 'favourites'
          ? favouritePuzzles.map((puzzle) => ({
              puzzleId: puzzle.id,
              puzzle,
              progress: data.byPuzzle[puzzle.id]?.[0],
            }))
          : data.userPuzzles.map((puzzle) => ({
              puzzleId: puzzle.id,
              puzzle,
              progress: data.byPuzzle[puzzle.id]?.[0],
            }));

  const emptyCopy = EMPTY_COPY[tab];

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Text style={styles.pageTitle}>My Library</Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabs}
        >
          {TABS.map(({ key, label }, index) => (
            <PopChip
              key={key}
              label={label}
              tone={accentAt(index)}
              selected={tab === key}
              onPress={() => setTab(key)}
            />
          ))}
        </ScrollView>

        <ScrollView contentContainerStyle={styles.content}>
          {visible.length === 0 ? (
            <EmptyState icon={emptyCopy.icon} text={emptyCopy.text} sub={emptyCopy.sub} />
          ) : (
            visible.map((item, index) => (
              <LibraryRow
                key={item.progress ? `${item.puzzleId}-${item.progress.gridSize}` : item.puzzleId}
                puzzleId={item.puzzleId}
                puzzle={item.puzzle}
                progress={item.progress}
                accent={accentAt(index)}
                isFavourite={data.favouriteIds.has(item.puzzleId)}
                onToggleFavourite={onToggleFavourite}
              />
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function LibraryRow({
  puzzleId,
  puzzle,
  progress,
  accent,
  isFavourite,
  onToggleFavourite,
}: {
  puzzleId: string;
  puzzle?: PuzzleDefinition;
  progress?: PuzzleProgressSummary;
  /** Deterministic per-position accent from `accentAt` — the colour frame around the row. */
  accent: string;
  isFavourite: boolean;
  onToggleFavourite: (puzzleId: string) => void;
}) {
  const router = useRouter();
  const done = progress?.status === 'completed';
  const source = puzzle ? resolvePuzzleImageSource(puzzle) : null;
  const title = puzzle?.title ?? puzzleId;

  // A puzzle with a saved session resumes straight onto the board; anything
  // else (favourited or imported but never played) starts at difficulty pick.
  const href =
    progress != null && progress.lockedPieces > 0
      ? { pathname: '/game/[puzzleId]' as const, params: { puzzleId, size: String(progress.gridSize) } }
      : { pathname: '/difficulty/[puzzleId]' as const, params: { puzzleId } };

  return (
    <PopSurface fill={accent} radius={radii.md} contentStyle={styles.rowFrame}>
      <View style={styles.rowBody}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={title}
          style={styles.rowMain}
          onPress={() => router.push(href)}
        >
          <View style={styles.thumb}>
            {source != null ? (
              <Image
                source={typeof source === 'number' ? source : { uri: source }}
                style={styles.thumbImage}
                resizeMode="cover"
              />
            ) : (
              <PopIcon name="puzzle" size={26} color={colors.inkMuted} />
            )}
          </View>
          <View style={styles.rowCopy}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.rowMeta}>
              {progress
                ? `${progress.gridSize}×${progress.gridSize} · ${done ? 'Completed' : `${Math.round((progress.lockedPieces / progress.totalPieces) * 100)}%`}`
                : 'Choose 3×3 up to 10×10'}
            </Text>
            {progress ? (
              <PopProgress
                value={progress.lockedPieces}
                goal={progress.totalPieces}
                tone={done ? colors.mint : colors.grape}
                height={8}
              />
            ) : null}
          </View>
          <PopIcon name="chevron" size={20} color={colors.inkMuted} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isFavourite ? `Remove ${title} from favourites` : `Add ${title} to favourites`}
          accessibilityState={{ selected: isFavourite }}
          hitSlop={10}
          onPress={() => onToggleFavourite(puzzleId)}
          style={styles.heartButton}
        >
          <PopIcon
            name="heart"
            size={22}
            color={isFavourite ? colors.cherry : colors.inkMuted}
            weight={isFavourite ? 'fill' : 'regular'}
          />
        </Pressable>
      </View>
    </PopSurface>
  );
}

function EmptyState({ icon, text, sub }: { icon: PopIconName; text: string; sub: string }) {
  return (
    <View style={styles.emptyWrap}>
      <PopIcon name={icon} size={48} color={colors.inkMuted} />
      <Text style={styles.emptyTitle}>{text}</Text>
      <Text style={styles.emptySub}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  safe: { flex: 1 },
  pageTitle: { ...typography.title, color: colors.ink, marginTop: spacing.sm, paddingHorizontal: spacing.lg },
  tabs: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  content: {
    padding: spacing.lg,
    paddingTop: 0,
    gap: spacing.md,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  // Inset padding on the coloured `PopSurface` face, so a ring of `accent` shows
  // as a frame around the white row body nested inside it (see HomeScreen's
  // `PuzzleCard` — ink-on-saturated-fill body text fails contrast).
  rowFrame: { padding: spacing.xs },
  rowBody: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  heartButton: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: radii.sm,
    overflow: 'hidden',
    backgroundColor: colors.sunshine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImage: { width: '100%', height: '100%' },
  rowCopy: { flex: 1, gap: 4 },
  rowTitle: { ...typography.heading, fontSize: 18, color: colors.ink },
  rowMeta: { ...typography.caption, color: colors.inkMuted },
  emptyWrap: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
  emptyTitle: { ...typography.heading, color: colors.ink, marginTop: spacing.sm },
  emptySub: { ...typography.body, color: colors.inkMuted, textAlign: 'center' },
});
