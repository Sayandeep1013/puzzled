import * as ImagePicker from 'expo-image-picker';
import { Link, useFocusEffect } from 'expo-router';
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
  listCatalog,
  type PuzzleProgressSummary,
} from '@/data';
import { type PuzzleDefinition } from '@/game-engine';
import { colors, radii, spacing } from '@/shared/theme';

interface HomeData {
  bundled: PuzzleDefinition[];
  user: PuzzleDefinition[];
  /** All saved sessions for a puzzle, most recently played first. */
  byPuzzle: Record<string, PuzzleProgressSummary[]>;
}

const EMPTY: HomeData = { bundled: [], user: [], byPuzzle: {} };

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

  return { bundled, user, byPuzzle };
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
            <Text style={styles.cardLabel}>YOUR PROGRESS</Text>
            <Text style={styles.progressValue}>
              {placed} {placed === 1 ? 'piece' : 'pieces'} placed
            </Text>
            <Text style={styles.cardDescription}>
              Progress is stored on this device, even when you are offline.
            </Text>
          </View>
          <View style={styles.progressRing}>
            <Text style={styles.progressPercent}>{percent}%</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Ready to play?</Text>
            <Text style={styles.sectionMeta}>
              {data.bundled.length} starter{data.bundled.length === 1 ? '' : 's'}
            </Text>
          </View>
          {data.bundled.map((puzzle) => (
            <PuzzleCard key={puzzle.id} puzzle={puzzle} rows={data.byPuzzle[puzzle.id] ?? []} />
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
            style={({ pressed }) => [styles.importButton, pressed && styles.importButtonPressed]}
          >
            {importing ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <Text style={styles.importPlus}>＋</Text>
            )}
            <Text style={styles.importText}>
              {importing ? 'Adding your photo…' : 'Add from gallery'}
            </Text>
          </Pressable>

          {data.user.length === 0 ? (
            <Text style={styles.emptyHint}>
              Pick any photo and it becomes a jigsaw you can play at 3×3 up to 10×10.
            </Text>
          ) : (
            data.user.map((puzzle) => (
              <PuzzleCard
                key={puzzle.id}
                puzzle={puzzle}
                rows={data.byPuzzle[puzzle.id] ?? []}
                previewUri={puzzle.image.uri}
                onDelete={() => onDelete(puzzle)}
              />
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PuzzleCard({
  puzzle,
  rows,
  previewUri,
  onDelete,
}: {
  puzzle: PuzzleDefinition;
  rows: PuzzleProgressSummary[];
  previewUri?: string;
  onDelete?: () => void;
}) {
  const latest = rows[0]; // Most recently played size, or undefined.
  const done = latest?.status === 'completed';
  const started = latest != null && latest.lockedPieces > 0;
  // Continue resumes the last size you played; a new puzzle uses its default.
  const resumeSize = latest?.gridSize ?? puzzle.gridSize;

  return (
    <View style={styles.puzzleCard}>
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
        <Link
          href={{
            pathname: '/game/[puzzleId]',
            params: { puzzleId: puzzle.id, size: String(resumeSize) },
          }}
          asChild
        >
          {/* `Link asChild` overwrites the child's `style` prop, which silently
              erased the button fill. Keep the visuals on an inner View. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${started ? 'Continue' : 'Start'} ${puzzle.title} puzzle`}
          >
            {({ pressed }) => (
              <View style={[styles.playButton, pressed && styles.playButtonPressed]}>
                <Text style={styles.playButtonText}>
                  {done ? 'Play again' : started ? 'Continue' : 'Start puzzle'}
                </Text>
              </View>
            )}
          </Pressable>
        </Link>
      </View>
    </View>
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
  section: {
    gap: spacing.md,
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
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  importButtonPressed: {
    backgroundColor: colors.sage,
  },
  importPlus: {
    color: colors.accent,
    fontSize: 22,
    fontWeight: '800',
    marginTop: -2,
  },
  importText: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  emptyHint: {
    color: colors.inkMuted,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: spacing.xs,
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
  previewImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
    alignSelf: 'flex-start',
    color: colors.surfaceStrong,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    // Legible over any photo.
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
  deleteButtonPressed: {
    backgroundColor: colors.accentPressed,
  },
  deleteButtonText: {
    color: colors.surfaceStrong,
    fontSize: 12,
    fontWeight: '800',
  },
  puzzleDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    padding: spacing.lg,
  },
  puzzleCopy: {
    flex: 1,
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
