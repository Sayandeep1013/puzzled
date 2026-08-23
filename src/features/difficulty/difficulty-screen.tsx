import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getPuzzleById, resolvePuzzleImageSource } from '@/data';
import {
  expectedPieceCount,
  SUPPORTED_GRID_SIZES,
  type GridSize,
  type PuzzleDefinition,
} from '@/game-engine';
import { type ArtName } from '@/shared/art';
import { colors, radii, spacing, typography } from '@/shared/theme';
import { Art, PopButton, PopHeader, PopSurface, Text } from '@/shared/ui';

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

export function DifficultyScreen({ puzzleId }: { puzzleId: string }) {
  const router = useRouter();
  const [puzzle, setPuzzle] = useState<PuzzleDefinition | null>(null);
  const [image, setImage] = useState<number | string | null>(null);
  const [selected, setSelected] = useState<GridSize | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const found = await getPuzzleById(puzzleId);
      if (!active) return;
      setPuzzle(found);
      setImage(found ? resolvePuzzleImageSource(found) : null);
      setSelected(found?.gridSize ?? 6);
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
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <PopHeader title="Select Difficulty" onBack={() => router.back()} />

        <ScrollView contentContainerStyle={styles.content}>
          {/* A cream frame around the artwork, matching the mockup's board and
              level cards — the photo is the hero, the chrome sits around it. */}
          <PopSurface fill={colors.surface} radius={radii.lg} contentStyle={styles.previewFrame}>
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
              return (
                <Pressable
                  key={size}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${expectedPieceCount(size)} pieces, ${tierFor(size)}`}
                  onPress={() => setSelected(size)}
                  style={styles.tile}
                >
                  {/* Selected tiles fill grass with white numerals; unselected
                      stay cream with ink. The mockup distinguishes the two by
                      fill, not by a ring. */}
                  <PopSurface
                    fill={active ? colors.grassDeep : colors.surface}
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
                  </PopSurface>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <PopButton label="Start Puzzle" tone="grass" onPress={start} disabled={!puzzle} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  safe: { flex: 1 },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
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
    backgroundColor: colors.white,
  },
  previewImage: { width: '100%', height: '100%' },
  previewFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  puzzleTitle: { ...typography.title, color: colors.headingGreen, textAlign: 'center' },
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
  tileCount: { ...typography.title, fontSize: 30, color: colors.ink },
  tileCountActive: { color: colors.onFill },
  tileTier: { ...typography.label, color: colors.inkMuted },
  // 3.25:1 on grassDeep — the same pairing PopButton uses for its grass tone.
  tileTierActive: { color: colors.onFill },
  // Bottom padding as well as top: without it the button sat flush against the
  // gesture bar.
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
});
