import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getCompletionsRepository,
  getFavouritesRepository,
  getProgressRepository,
  getUserPuzzleRepository,
  isUserPuzzle,
  latestPerBoard,
  listCatalog,
  resolvePuzzleImageSource,
  type PuzzleCompletion,
  type PuzzleProgressSummary,
} from '@/data';
import { type PuzzleDefinition } from '@/game-engine';
import { type ArtName } from '@/shared/art';
import { accentAt, colors, radii, shadow, spacing, typography } from '@/shared/theme';

import { fallbackPhotoTitle, titleForImportedPhoto } from './photo-title';
import { Art, PopChip, PopIcon, PopProgress, PopSurface, Text, useTabBarSpace } from '@/shared/ui';

type Tab = 'progress' | 'completed' | 'favourites' | 'photos';

const TABS: { key: Tab; label: string }[] = [
  { key: 'progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
  { key: 'favourites', label: 'Favourites' },
  { key: 'photos', label: 'My Photos' },
];

const EMPTY_COPY: Record<Tab, { art: ArtName; text: string; sub: string }> = {
  progress: {
    art: 'puzzle-quad',
    text: 'Nothing in progress',
    sub: 'Start a puzzle from Home or the Puzzles tab.',
  },
  completed: {
    art: 'sticker-book',
    text: 'No completed puzzles yet',
    sub: 'Finish a puzzle to see it here.',
  },
  favourites: {
    art: 'reward',
    text: 'No favourites yet',
    sub: 'Tap the heart on a puzzle to save it here.',
  },
  photos: {
    art: 'album',
    text: 'No photos yet',
    sub: 'Tap Add from gallery above to make any photo a jigsaw.',
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
  /**
   * Boards ever finished, newest first, one entry per board.
   *
   * Separate from `rows` because a session row is *current* state: replaying a
   * finished puzzle turns its row back into an in-progress one, which used to
   * drop it out of the Completed tab entirely.
   */
  completions: PuzzleCompletion[];
  /** Sessions grouped per puzzle id, so Favourites/Photos can show the latest one. */
  byPuzzle: Record<string, PuzzleProgressSummary[]>;
  catalogById: Map<string, PuzzleDefinition>;
  userPuzzles: PuzzleDefinition[];
  favouriteIds: Set<string>;
}

const EMPTY_DATA: LibraryData = {
  rows: [],
  completions: [],
  byPuzzle: {},
  catalogById: new Map(),
  userPuzzles: [],
  favouriteIds: new Set(),
};

async function loadLibraryData(): Promise<LibraryData> {
  const [{ bundled, user }, summaries, favouriteIds, completions] = await Promise.all([
    listCatalog(),
    (await getProgressRepository()).listSummaries().catch(() => [] as PuzzleProgressSummary[]),
    (await getFavouritesRepository()).list().catch(() => [] as string[]),
    (await getCompletionsRepository()).list().catch(() => [] as PuzzleCompletion[]),
  ]);

  const catalogById = new Map<string, PuzzleDefinition>();
  for (const puzzle of [...bundled, ...user]) catalogById.set(puzzle.id, puzzle);

  const byPuzzle: Record<string, PuzzleProgressSummary[]> = {};
  for (const row of summaries) {
    (byPuzzle[row.puzzleId] ??= []).push(row);
  }

  return {
    rows: summaries.map((s) => ({ ...s, puzzle: catalogById.get(s.puzzleId) })),
    completions: latestPerBoard(completions),
    byPuzzle,
    catalogById,
    userPuzzles: user,
    favouriteIds: new Set(favouriteIds),
  };
}

export function LibraryScreen() {
  const [tab, setTab] = useState<Tab>('progress');
  const [data, setData] = useState<LibraryData>(EMPTY_DATA);
  const [importing, setImporting] = useState(false);
  const tabBarSpace = useTabBarSpace();

  /** Numbers the fallback title, so successive imports stay distinguishable. */
  const photoCount = data.userPuzzles.length;

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
    try {
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
    } catch {
      // Best-effort; a failed toggle never touched storage, so leaving local
      // state untouched keeps the heart consistent with what's persisted.
    }
  }, []);

  /** Moved verbatim from Home so imported photos land on the tab that lists them. */
  const onImport = useCallback(async () => {
    if (importing) {
      return;
    }
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Photos permission needed',
          'Allow photo access to turn an image into a puzzle.',
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });
      if (result.canceled || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      setImporting(true);
      await (
        await getUserPuzzleRepository()
      ).add({
        // Cropping in the picker (which this flow always asks for) makes Android
        // return a fresh file named with a UUID, so the old "tidy up the file
        // name" pass produced puzzles literally titled `2c2550e4 36fc 4a2b ...`.
        title: titleForImportedPhoto(asset.fileName, fallbackPhotoTitle(photoCount)),
        sourceUri: asset.uri,
        pixelSize: { width: asset.width, height: asset.height },
      });
      setData(await loadLibraryData());
    } catch {
      Alert.alert(
        'Could not import',
        'Something went wrong adding that image. Please try another.',
      );
    } finally {
      setImporting(false);
    }
  }, [importing, photoCount]);

  /**
   * Delete an imported photo, its board(s), and the copied image file.
   *
   * Importing was one-way: `UserPuzzleRepository.remove` and
   * `ProgressRepository.deleteSessionsForPuzzle` both existed and neither had a
   * caller, so a mis-picked photo stayed in Library, in Puzzles, and in the
   * daily pool permanently. Only imported photos are removable — bundled
   * puzzles are read-only.
   */
  const onDeletePhoto = useCallback((puzzleId: string, title: string, wasFavourite: boolean) => {
    Alert.alert(
      `Delete “${title}”?`,
      'This also deletes any progress on it. It cannot be undone.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                // Sessions first: a puzzle row removed while its boards survive
                // would leave rows Library cannot resolve a title for.
                await (await getProgressRepository()).deleteSessionsForPuzzle(puzzleId);
                // And its history — a completions row for a puzzle that no
                // longer exists would keep counting toward achievements and
                // stats with nothing left to point at.
                await (await getCompletionsRepository()).deleteForPuzzle(puzzleId);
                // The favourites table keys on puzzle id with nothing pointing
                // back at it, so a starred photo would leave a row that can never
                // be reached again — invisible (Favourites resolves ids through
                // the catalog) but accumulating.
                if (wasFavourite) {
                  await (await getFavouritesRepository()).toggle(puzzleId);
                }
                await (await getUserPuzzleRepository()).remove(puzzleId);
              } catch {
                // Best-effort; the refresh below shows whatever actually survived
                // rather than asserting a delete that may not have happened.
              }
              setData(await loadLibraryData());
            })();
          },
        },
      ],
    );
  }, []);

  const inProgress = data.rows.filter((r) => r.status !== 'completed' && r.lockedPieces > 0);
  const favouritePuzzles = Array.from(data.favouriteIds)
    .map((id) => data.catalogById.get(id))
    .filter((puzzle): puzzle is PuzzleDefinition => puzzle != null);

  const visible: VisibleItem[] =
    tab === 'progress'
      ? inProgress.map((row) => ({ puzzleId: row.puzzleId, puzzle: row.puzzle, progress: row }))
      : tab === 'completed'
        ? data.completions.map((entry) => ({
            puzzleId: entry.puzzleId,
            puzzle: data.catalogById.get(entry.puzzleId),
            // The board's *current* row, so a replayed puzzle shows its live
            // progress bar under a card that is here because it was finished once.
            progress: data.byPuzzle[entry.puzzleId]?.find((r) => r.gridSize === entry.gridSize),
          }))
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
        <View style={styles.titleRow}>
          <Text style={styles.pageTitle} numberOfLines={1}>
            My Library
          </Text>
          {/* Pinned beside the title rather than only inside the My Photos tab.
              Buried on one tab it was unfindable — the whole point of the feature
              is that it is the way puzzles get added. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add a puzzle from your gallery"
            onPress={onImport}
            disabled={importing}
            style={styles.addButton}
          >
            {importing ? (
              <ActivityIndicator color={colors.grass} />
            ) : (
              <>
                <Art name="plus-circle" size={24} />
                <Text style={styles.addLabel}>Add photo</Text>
              </>
            )}
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsRow}
          contentContainerStyle={styles.tabs}
        >
          {/* One tone for every tab. Cycling `accentAt` per tab meant the
              selected chip was blue here and green elsewhere, which read as a
              bug rather than a system. */}
          {TABS.map(({ key, label }) => (
            <PopChip
              key={key}
              label={label}
              tone={colors.grass}
              selected={tab === key}
              onPress={() => setTab(key)}
            />
          ))}
        </ScrollView>

        <ScrollView
          style={styles.list}
          contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace }]}
        >
          {visible.length === 0 ? (
            <EmptyState art={emptyCopy.art} text={emptyCopy.text} sub={emptyCopy.sub} />
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
                onDelete={onDeletePhoto}
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
  onDelete,
}: {
  puzzleId: string;
  puzzle?: PuzzleDefinition;
  progress?: PuzzleProgressSummary;
  /** Deterministic per-position accent from `accentAt` — the colour frame around the row. */
  accent: string;
  isFavourite: boolean;
  onToggleFavourite: (puzzleId: string) => void;
  /** Offered only for imported photos; bundled puzzles are read-only. */
  onDelete: (puzzleId: string, title: string, wasFavourite: boolean) => void;
}) {
  const router = useRouter();
  const done = progress?.status === 'completed';
  const source = puzzle ? resolvePuzzleImageSource(puzzle) : null;
  const title = puzzle?.title ?? puzzleId;
  const removable = puzzle != null && isUserPuzzle(puzzle);

  // A puzzle with a saved session resumes straight onto the board; anything
  // else (favourited or imported but never played) starts at difficulty pick.
  const href =
    progress != null && progress.lockedPieces > 0
      ? {
          pathname: '/game/[puzzleId]' as const,
          params: { puzzleId, size: String(progress.gridSize) },
        }
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
              <Art name="puzzle-quad" size={30} />
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
                // Sky for in-progress, grass for done. Berry read as an
                // off-palette purple against the green-and-cream rows.
                tone={done ? colors.grass : colors.sky}
                height={8}
              />
            ) : null}
          </View>
          {/* The chevron is decoration — it says "this row opens", which the
              whole row already says. On an imported photo that space earns its
              keep as the only way to remove one: importing used to be one-way,
              so a mis-picked photo stayed in Library, in Puzzles and in the
              daily pool forever. */}
          {removable ? null : <PopIcon name="chevron" size={20} color={colors.inkMuted} />}
        </Pressable>
        {removable ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Delete ${title}`}
            accessibilityHint="Also deletes any progress on this puzzle"
            hitSlop={10}
            onPress={() => onDelete(puzzleId, title, isFavourite)}
            style={styles.deleteButton}
          >
            <PopIcon name="trash" size={20} color={colors.inkMuted} />
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            isFavourite ? `Remove ${title} from favourites` : `Add ${title} to favourites`
          }
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

function EmptyState({ art, text, sub }: { art: ArtName; text: string; sub: string }) {
  return (
    <View style={styles.emptyWrap}>
      <Art name={art} size={72} />
      <Text style={styles.emptyTitle}>{text}</Text>
      <Text style={styles.emptySub}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  safe: { flex: 1 },
  pageTitle: {
    ...typography.title,
    color: colors.headingGreen,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    // Gives way to the Add button beside it rather than pushing it off the row.
    flexShrink: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: spacing.lg,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    boxShadow: shadow.card,
  },
  addLabel: { ...typography.caption, color: colors.ink },
  /**
   * The tab strip must hug its chips.
   *
   * A horizontal `ScrollView` has no intrinsic height, so as a flex child of this
   * column it stretched to fill everything left under the title — the chips drew at
   * the top of that over-tall box and the list below it started halfway down the
   * screen, which is why a single in-progress puzzle floated in the middle and long
   * lists ran off the bottom. `content` already carried `flexGrow: 0` and a comment
   * asking for exactly this; the strip above it was what actually took the space.
   */
  tabsRow: { flexGrow: 0 },
  tabs: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  /** Takes the rest of the column, so the list scrolls within it rather than being cut off. */
  list: { flex: 1 },
  content: {
    padding: spacing.lg,
    paddingTop: 0,
    gap: spacing.md,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    // Short lists sit under the tabs rather than centring in `list`'s height.
    justifyContent: 'flex-start',
    flexGrow: 0,
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
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  heartButton: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  // Narrower than the heart's padding: two full-width targets side by side left
  // the title with nowhere to go on a narrow phone.
  deleteButton: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: spacing.md,
    paddingLeft: spacing.xs,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: radii.sm,
    overflow: 'hidden',
    backgroundColor: colors.honey,
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
