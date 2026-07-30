import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getPuzzleById, resolvePuzzleImageSource } from '@/data';
import {
  expectedPieceCount,
  SUPPORTED_GRID_SIZES,
  type GridSize,
  type PuzzleDefinition,
} from '@/game-engine';
import { colors, radii, spacing, typography } from '@/shared/theme';
import { PopButton, PopHeader, PopIcon, PopSurface } from '@/shared/ui';

/** Difficulty word for a grid size, mirroring the tiers in the mockup. */
function tierFor(size: GridSize): string {
  if (size <= 4) return 'Easy';
  if (size <= 7) return 'Medium';
  return 'Hard';
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
          {/* Tangerine frames a white body around the preview image, matching
              `daily-screen.tsx`'s `featureFrame` treatment. */}
          <PopSurface fill={colors.apricot} radius={radii.lg} contentStyle={styles.previewFrame}>
            <View style={styles.previewBody}>
              {image != null ? (
                <Image
                  source={typeof image === 'number' ? image : { uri: image }}
                  style={styles.previewImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.previewFallback}>
                  <PopIcon name="puzzle" size={64} color={colors.inkMuted} />
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
                  {/* Selected tiles ring in sunshine; the body underneath stays
                      white either way, so the two-line label is always read
                      against a plain surface — never a full colour wash. */}
                  <PopSurface
                    fill={active ? colors.honey : colors.surface}
                    radius={radii.md}
                    contentStyle={styles.tileFrame}
                  >
                    <View style={styles.tileBody}>
                      <Text style={styles.tileCount}>{expectedPieceCount(size)}</Text>
                      <Text style={styles.tileTier}>
                        {tierFor(size)} · {size}×{size}
                      </Text>
                    </View>
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
  // Inset padding on the coloured `PopSurface` face, so a ring of `tangerine`
  // shows as a frame around the white preview body nested inside it.
  previewFrame: { padding: spacing.xs },
  previewBody: {
    height: 200,
    overflow: 'hidden',
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  previewImage: { width: '100%', height: '100%' },
  previewFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  puzzleTitle: { ...typography.title, color: colors.ink, textAlign: 'center' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  tile: { width: '47%' },
  tileFrame: { padding: spacing.xs },
  tileBody: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: 2,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
  },
  tileCount: { ...typography.title, fontSize: 32, color: colors.ink },
  tileTier: { ...typography.label, color: colors.inkMuted },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
});
