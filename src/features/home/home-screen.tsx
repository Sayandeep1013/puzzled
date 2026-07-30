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
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getProgressRepository,
  getUserPuzzleRepository,
  getWalletRepository,
  listCatalog,
  type PuzzleProgressSummary,
} from '@/data';
import { type PuzzleDefinition } from '@/game-engine';
import { type ArtName } from '@/shared/art';
import { accentAt, backgrounds, colors, radii, shadow, spacing, typography } from '@/shared/theme';
import { Art, PopButton, PopSurface } from '@/shared/ui';

interface HomeData {
  bundled: PuzzleDefinition[];
  user: PuzzleDefinition[];
  /** All saved sessions for a puzzle, most recently played first. */
  byPuzzle: Record<string, PuzzleProgressSummary[]>;
  /** Null rather than a fabricated zero when the wallet cannot be read. */
  coins: number | null;
}

const EMPTY: HomeData = { bundled: [], user: [], byPuzzle: {}, coins: null };

async function loadHomeData(): Promise<HomeData> {
  const { bundled, user } = await listCatalog();

  const byPuzzle: Record<string, PuzzleProgressSummary[]> = {};
  try {
    // Rows arrive most-recent-first; preserve that so [0] is the resume target.
    const rows = await (await getProgressRepository()).listSummaries();
    for (const row of rows) {
      (byPuzzle[row.puzzleId] ??= []).push(row);
    }
  } catch {
    // Progress is best-effort; an unreadable database still lists puzzles.
  }

  let coins: number | null = null;
  try {
    coins = (await (await getWalletRepository()).balance()).coins;
  } catch {
    // Same contract as the shop: no balance is better than a wrong one.
  }

  return { bundled, user, byPuzzle, coins };
}

/** Turn a picked file name into a friendly title. */
function titleFromFileName(fileName: string | null | undefined): string {
  if (!fileName) {
    return 'My puzzle';
  }
  const withoutExt = fileName.replace(/\.[^.]+$/, '');
  const cleaned = withoutExt.replace(/[_-]+/g, ' ').trim();
  return cleaned.length > 0 ? cleaned.slice(0, 40) : 'My puzzle';
}

export function HomeScreen() {
  const [data, setData] = useState<HomeData>(EMPTY);
  const [importing, setImporting] = useState(false);
  const router = useRouter();

  // Refetch on focus so progress reflects the board you just left.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadHomeData().then((next) => {
        if (active) setData(next);
      });
      return () => {
        active = false;
      };
    }, []),
  );

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
        title: titleFromFileName(asset.fileName),
        sourceUri: asset.uri,
        pixelSize: { width: asset.width, height: asset.height },
      });
      setData(await loadHomeData());
    } catch {
      Alert.alert(
        'Could not import',
        'Something went wrong adding that image. Please try another.',
      );
    } finally {
      setImporting(false);
    }
  }, [importing]);

  const onDelete = useCallback((puzzle: PuzzleDefinition) => {
    Alert.alert('Delete puzzle?', `Remove “${puzzle.title}” and its saved progress?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await (await getUserPuzzleRepository()).remove(puzzle.id);
            await (await getProgressRepository()).deleteSessionsForPuzzle(puzzle.id);
          } catch {
            // Best-effort; a failed delete leaves the puzzle listed to retry.
          }
          setData(await loadHomeData());
        },
      },
    ]);
  }, []);

  const allRows = Object.values(data.byPuzzle).flat();
  const placed = allRows.reduce((sum, row) => sum + row.lockedPieces, 0);
  const totalAcross = allRows.reduce((sum, row) => sum + row.totalPieces, 0);
  const percent = totalAcross > 0 ? Math.round((placed / totalAcross) * 100) : 0;

  const firstPlayable = data.bundled[0] ?? data.user[0];

  return (
    <View style={styles.root}>
      {/* The mockup's Home sits on an illustrated meadow. Until that art lands
          (see assets/art-source/README.md) the ground is two solid bands: sky
          behind the hero, grass behind everything below it. */}
      <View style={styles.skyBand} pointerEvents="none" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.topBar}>
          <View style={styles.coinPill}>
            <Art name="coin" size={26} />
            <Text style={styles.coinText}>{data.coins ?? '—'}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Settings"
            hitSlop={10}
            onPress={() => router.push('/settings')}
            style={styles.gearButton}
          >
            <Art name="gear" size={26} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.hero}>
            <Text style={styles.title}>Puzzle Journey</Text>
            <Text style={styles.subtitle}>Relax your mind. Enjoy the moment.</Text>

            <Art name="bear" size={188} style={styles.mascot} />

            <PopButton
              label="Play"
              tone="grass"
              size="lg"
              icon={<Art name="play" size={26} />}
              style={styles.playNow}
              disabled={!firstPlayable}
              onPress={() => {
                if (firstPlayable) {
                  router.push({
                    pathname: '/difficulty/[puzzleId]',
                    params: { puzzleId: firstPlayable.id },
                  });
                }
              }}
            />

            <View style={styles.quickRow}>
              <QuickLink
                art="calendar"
                label="Daily Puzzle"
                onPress={() => router.push('/daily')}
              />
              <QuickLink art="album" label="My Album" onPress={() => router.push('/library')} />
            </View>
          </View>

          <PopSurface fill={colors.grass} radius={radii.lg} style={styles.progressCard}>
            <View style={styles.progressRow}>
              <View style={styles.progressCopy}>
                <Text style={styles.cardLabel}>YOUR PROGRESS</Text>
                <Text style={styles.progressValue}>
                  {placed} {placed === 1 ? 'piece' : 'pieces'} placed
                </Text>
                <Text style={styles.cardDescription}>Saved on this device, even offline.</Text>
              </View>
              <View style={styles.progressRing}>
                <Text style={styles.progressPercent}>{percent}%</Text>
              </View>
            </View>
          </PopSurface>

          <View style={styles.section}>
            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>Ready to play?</Text>
              <Text style={styles.sectionMeta}>
                {data.bundled.length} starter{data.bundled.length === 1 ? '' : 's'}
              </Text>
            </View>
            {data.bundled.map((puzzle, index) => (
              <PuzzleCard
                key={puzzle.id}
                puzzle={puzzle}
                rows={data.byPuzzle[puzzle.id] ?? []}
                fill={accentAt(index)}
              />
            ))}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>Your puzzles</Text>
              <Text style={styles.sectionMeta}>
                {data.user.length} {data.user.length === 1 ? 'photo' : 'photos'}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add a puzzle from your gallery"
              onPress={onImport}
              disabled={importing}
            >
              <PopSurface fill={colors.surface} radius={radii.lg}>
                <View style={styles.importInner}>
                  {importing ? (
                    <ActivityIndicator color={colors.grass} />
                  ) : (
                    <Text style={styles.importPlus}>＋</Text>
                  )}
                  <Text style={styles.importText}>
                    {importing ? 'Adding your photo…' : 'Add from gallery'}
                  </Text>
                </View>
              </PopSurface>
            </Pressable>

            {data.user.length === 0 ? (
              <Text style={styles.emptyHint}>
                Pick any photo and it becomes a jigsaw you can play at 3×3 up to 10×10.
              </Text>
            ) : (
              data.user.map((puzzle, index) => (
                <PuzzleCard
                  key={puzzle.id}
                  puzzle={puzzle}
                  rows={data.byPuzzle[puzzle.id] ?? []}
                  fill={accentAt(index)}
                  previewUri={puzzle.image.uri}
                  onDelete={() => onDelete(puzzle)}
                />
              ))
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function PuzzleCard({
  puzzle,
  rows,
  fill,
  previewUri,
  onDelete,
}: {
  puzzle: PuzzleDefinition;
  rows: PuzzleProgressSummary[];
  /** Deterministic per-position accent from `accentAt` — the colour frame around the card. */
  fill: string;
  previewUri?: string;
  onDelete?: () => void;
}) {
  const router = useRouter();
  const latest = rows[0]; // Most recently played size, or undefined.
  const done = latest?.status === 'completed';
  const started = latest != null && latest.lockedPieces > 0;
  // Continue/replay jumps straight to the last size; a fresh start picks difficulty.
  const resumeSize = latest?.gridSize ?? puzzle.gridSize;
  const href = started
    ? {
        pathname: '/game/[puzzleId]' as const,
        params: { puzzleId: puzzle.id, size: String(resumeSize) },
      }
    : { pathname: '/difficulty/[puzzleId]' as const, params: { puzzleId: puzzle.id } };

  return (
    <PopSurface fill={fill} radius={radii.lg} contentStyle={styles.cardFrame}>
      <View style={styles.cardBody}>
        <View style={styles.preview}>
          {previewUri ? (
            <Image source={{ uri: previewUri }} style={styles.previewImage} resizeMode="cover" />
          ) : (
            <>
              <View style={[styles.previewTile, styles.previewTileOne]} />
              <View style={[styles.previewTile, styles.previewTileTwo]} />
              <View style={[styles.previewTile, styles.previewTileThree]} />
            </>
          )}
          <Text style={styles.previewLabel}>
            {done ? 'Completed' : started ? 'In progress' : 'Not started'}
          </Text>
          {onDelete ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Delete ${puzzle.title}`}
              onPress={onDelete}
              hitSlop={10}
              style={({ pressed }) => [styles.deleteButton, pressed && styles.deleteButtonPressed]}
            >
              <Text style={styles.deleteButtonText}>Delete</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.puzzleDetails}>
          <View style={styles.puzzleCopy}>
            <Text style={styles.puzzleTitle} numberOfLines={1}>
              {puzzle.title}
            </Text>
            <Text style={styles.puzzleMeta}>
              {started
                ? `${latest.gridSize}×${latest.gridSize} · ${latest.lockedPieces}/${latest.totalPieces} placed`
                : 'Choose 3×3 up to 10×10'}
              {rows.length > 1 ? ` · ${rows.length} sizes` : ''}
            </Text>
          </View>
          <PopButton
            label={done ? 'Play again' : started ? 'Continue' : 'Start'}
            tone="grass"
            size="sm"
            accessibilityLabel={`${started ? 'Continue' : 'Start'} ${puzzle.title} puzzle`}
            onPress={() => router.push(href)}
          />
        </View>
      </View>
    </PopSurface>
  );
}

function QuickLink({ art, label, onPress }: { art: ArtName; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.quickLink}
    >
      <PopSurface fill={colors.surface} radius={radii.md}>
        <View style={styles.quickLinkInner}>
          <Art name={art} size={30} />
          <Text style={styles.quickLinkLabel}>{label}</Text>
        </View>
      </PopSurface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: backgrounds.homeGrass },
  // Absolute rather than a wrapper so the ScrollView still owns the full
  // height and the band does not scroll away with the hero.
  skyBand: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '52%',
    backgroundColor: backgrounds.homeSky,
  },
  safeArea: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  coinPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingLeft: spacing.xs,
    paddingRight: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    boxShadow: shadow.card,
  },
  coinText: { ...typography.heading, fontSize: 18, color: colors.ink },
  gearButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    boxShadow: shadow.card,
  },
  mascot: { marginVertical: spacing.xs },
  quickRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignSelf: 'stretch',
    marginTop: spacing.sm,
    maxWidth: 320,
    width: '100%',
  },
  quickLink: { flex: 1 },
  quickLinkInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  quickLinkLabel: { ...typography.bodyStrong, fontSize: 14, color: colors.ink },
  content: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.xl,
  },
  hero: { alignItems: 'center', gap: spacing.sm },
  title: {
    ...typography.hero,
    color: colors.headingBlue,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    fontSize: 17,
    // Deep blue rather than muted brown: the hero sits on sky, and inkMuted
    // washes out against it.
    color: colors.headingBlue,
    textAlign: 'center',
  },
  playNow: { alignSelf: 'stretch', marginTop: spacing.sm, maxWidth: 320, width: '100%' },
  progressCard: { width: '100%' },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    padding: spacing.lg,
  },
  progressCopy: { flex: 1, gap: spacing.xs },
  cardLabel: { ...typography.label, color: colors.ink },
  progressValue: { ...typography.heading, color: colors.ink },
  cardDescription: { ...typography.caption, color: colors.inkMuted },
  progressRing: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 5,
    borderColor: colors.surface,
    borderRadius: radii.pill,
  },
  progressPercent: { ...typography.bodyStrong, color: colors.ink, fontSize: 17 },
  section: { gap: spacing.md },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionTitle: { ...typography.title, fontSize: 26, color: colors.ink },
  sectionMeta: { ...typography.caption, color: colors.inkMuted },
  importInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  importPlus: { ...typography.title, color: colors.headingGreen, marginTop: -2 },
  importText: { ...typography.bodyStrong, color: colors.ink },
  emptyHint: {
    ...typography.body,
    color: colors.inkMuted,
    paddingHorizontal: spacing.xs,
  },
  // Inset padding on the coloured `PopSurface` face, so a ring of `fill` shows
  // as a frame around the white card body nested inside it.
  cardFrame: { padding: spacing.xs },
  cardBody: { overflow: 'hidden', borderRadius: radii.md, backgroundColor: colors.surface },
  preview: {
    height: 200,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    padding: spacing.lg,
    backgroundColor: '#F4C78D',
    borderTopLeftRadius: radii.md,
    borderTopRightRadius: radii.md,
  },
  previewImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  previewTile: { position: 'absolute', width: 180, height: 180, borderRadius: radii.pill },
  previewTileOne: { top: -70, left: -20, backgroundColor: '#E88962' },
  previewTileTwo: { top: 20, right: -30, backgroundColor: '#759A88' },
  previewTileThree: { bottom: -110, left: 110, backgroundColor: '#F8E6B9' },
  previewLabel: {
    ...typography.label,
    alignSelf: 'flex-start',
    color: colors.surface,
    textTransform: 'uppercase',
    backgroundColor: 'rgba(23,33,33,0.45)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
    overflow: 'hidden',
  },
  deleteButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(23,33,33,0.55)',
  },
  deleteButtonPressed: { backgroundColor: colors.cherry },
  deleteButtonText: { ...typography.caption, color: colors.surface },
  puzzleDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    padding: spacing.lg,
  },
  puzzleCopy: { flex: 1 },
  puzzleTitle: { ...typography.heading, color: colors.ink },
  puzzleMeta: { ...typography.caption, marginTop: spacing.xs, color: colors.inkMuted },
});
