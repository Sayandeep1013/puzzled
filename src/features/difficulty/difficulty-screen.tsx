import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getProgressRepository,
  getPuzzleById,
  resolvePuzzleImageSource,
  type PuzzleProgressSummary,
} from '@/data';
import {
  expectedPieceCount,
  SUPPORTED_GRID_SIZES,
  type GridSize,
  type PuzzleDefinition,
} from '@/game-engine';
import { type ArtName } from '@/shared/art';
import { useTheme } from '@/shared/theme-context';
import { createThemedStyles } from '@/shared/themed-styles';
import { radii, spacing, typography } from '@/shared/theme';
import { Art, PopButton, PopHeader, PopSurface, Text, ThemeGround } from '@/shared/ui';

/** Difficulty word for a grid size, mirroring the tiers in the mockup. */
function tierFor(size: GridSize): string {
  if (size <= 4) return 'Easy';
  if (size <= 7) return 'Medium';
  return 'Hard';
}

/**
 * Piece art per tier. The mockup labels its three piece counts with a coloured
 * jigsaw piece each; the asset set ships green, yellow and brown pieces, so the
 * tiers map onto them in ascending difficulty.
 */
function pieceArtFor(size: GridSize): ArtName {
  if (size <= 4) return 'puzzle-green';
  if (size <= 7) return 'puzzle-yellow';
  return 'puzzle-brown';
}

/** The board the player touched last, so the picker can open on it. */
function mostRecent(rows: PuzzleProgressSummary[]): PuzzleProgressSummary | null {
  return rows.reduce<PuzzleProgressSummary | null>(
    (latest, row) => (latest == null || row.updatedAt > latest.updatedAt ? row : latest),
    null,
  );
}

export function DifficultyScreen({ puzzleId }: { puzzleId: string }) {
  const theme = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const [puzzle, setPuzzle] = useState<PuzzleDefinition | null>(null);
  const [image, setImage] = useState<number | string | null>(null);
  const [selected, setSelected] = useState<GridSize | null>(null);
  const [saved, setSaved] = useState<Map<GridSize, PuzzleProgressSummary>>(new Map());

  useEffect(() => {
    let active = true;
    (async () => {
      const [found, summaries] = await Promise.all([
        getPuzzleById(puzzleId),
        (await getProgressRepository()).listSummaries().catch(() => [] as PuzzleProgressSummary[]),
      ]);
      if (!active) return;

      // Every size of *this* puzzle the player has a board for. Boards are
      // stored per (puzzle, size), so two sizes of one image are two saves.
      const unfinished = summaries.filter(
        (row) => row.puzzleId === puzzleId && row.status !== 'completed',
      );
      setPuzzle(found);
      setImage(found ? resolvePuzzleImageSource(found) : null);
      setSaved(new Map(unfinished.map((row) => [row.gridSize, row])));
      // Land on the board they were last on rather than the definition's
      // default: arriving at a fresh 4x4 with a half-built 3x3 saved reads as
      // the progress having been thrown away, when it is simply another board.
      setSelected(mostRecent(unfinished)?.gridSize ?? found?.gridSize ?? 6);
    })();
    return () => {
      active = false;
    };
  }, [puzzleId]);

  const start = () => {
    if (!puzzle || selected == null) return;
    router.push({
      pathname: '/game/[puzzleId]',
      params: { puzzleId: puzzle.id, size: String(selected) },
    });
  };

  return (
    <View style={styles.root}>
      <ThemeGround />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <PopHeader title="Select Difficulty" onBack={() => router.back()} />

        <ScrollView contentContainerStyle={styles.content}>
          {/* A cream frame around the artwork, matching the mockup's board and
              level cards — the photo is the hero, the chrome sits around it. */}
          <PopSurface
            fill={theme.colors.surface}
            radius={radii.lg}
            contentStyle={styles.previewFrame}
          >
            <View style={styles.previewBody}>
              {image != null ? (
                <Image
                  source={typeof image === 'number' ? image : { uri: image }}
                  style={styles.previewImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.previewFallback}>
                  <Art name="preview-image" size={72} />
                </View>
              )}
            </View>
          </PopSurface>

          <Text style={styles.puzzleTitle}>{puzzle?.title ?? 'Puzzle'}</Text>

          <View style={styles.grid}>
            {SUPPORTED_GRID_SIZES.map((size) => {
              const active = size === selected;
              const board = saved.get(size);
              return (
                <Pressable
                  key={size}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={
                    board
                      ? `${expectedPieceCount(size)} pieces, ${tierFor(size)}, ` +
                        `${board.lockedPieces} of ${board.totalPieces} already placed`
                      : `${expectedPieceCount(size)} pieces, ${tierFor(size)}`
                  }
                  onPress={() => setSelected(size)}
                  style={styles.tile}
                >
                  {/* Selected tiles fill grass with white numerals; unselected
                      stay cream with ink. The mockup distinguishes the two by
                      fill, not by a ring. */}
                  <PopSurface
                    fill={active ? theme.colors.grassDeep : theme.colors.surface}
                    radius={radii.md}
                    elevation={active ? 'raised' : 'card'}
                    contentStyle={styles.tileBody}
                  >
                    <Art name={pieceArtFor(size)} size={38} />
                    <Text style={[styles.tileCount, active && styles.tileCountActive]}>
                      {expectedPieceCount(size)}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[styles.tileTier, active && styles.tileTierActive]}
                    >
                      {tierFor(size)} · {size}×{size}
                    </Text>
                    {/* Absolutely positioned so a tile with a board saved is
                        exactly as tall as one without — a third line here would
                        leave the wrapped rows ragged, and worse at large font
                        scales. */}
                    {board ? (
                      <View style={styles.tileSaved}>
                        <Text style={styles.tileSavedText}>
                          {board.lockedPieces}/{board.totalPieces}
                        </Text>
                      </View>
                    ) : null}
                  </PopSurface>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <PopButton
            label={selected != null && saved.has(selected) ? 'Continue' : 'Start Puzzle'}
            tone="grass"
            onPress={start}
            disabled={!puzzle}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const useStyles = createThemedStyles((theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.colors.paper },
    safe: { flex: 1 },
    content: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.xl,
      gap: spacing.md,
      width: '100%',
      maxWidth: 620,
      alignSelf: 'center',
    },
    // A cream margin around the artwork rather than a coloured ring.
    previewFrame: { padding: spacing.sm },
    previewBody: {
      height: 200,
      overflow: 'hidden',
      borderRadius: radii.md,
      backgroundColor: theme.colors.white,
    },
    previewImage: { width: '100%', height: '100%' },
    previewFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    puzzleTitle: { ...typography.title, color: theme.colors.headingGreen, textAlign: 'center' },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
      justifyContent: 'space-between',
    },
    tile: { width: '47%' },
    tileBody: {
      alignItems: 'center',
      paddingVertical: spacing.md,
      gap: 2,
    },
    tileCount: { ...typography.title, fontSize: 30, color: theme.colors.ink },
    tileCountActive: { color: theme.colors.onFill },
    tileTier: { ...typography.label, color: theme.colors.inkMuted },
    // The "you have a board here" pill. Out of flow (see the render) so it
    // cannot change a tile's height.
    tileSaved: {
      position: 'absolute',
      top: spacing.xs,
      right: spacing.xs,
      paddingHorizontal: spacing.xs,
      paddingVertical: 1,
      borderRadius: radii.sm,
      backgroundColor: theme.colors.honey,
    },
    tileSavedText: { ...typography.label, fontSize: 11, color: theme.colors.ink },
    // 3.25:1 on grassDeep — the same pairing PopButton uses for its grass tone.
    tileTierActive: { color: theme.colors.onFill },
    // Bottom padding as well as top: without it the button sat flush against the
    // gesture bar.
    footer: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
    },
  }),
);
