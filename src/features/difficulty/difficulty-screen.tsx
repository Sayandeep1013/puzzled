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
import { PaperBackground, SketchButton, SketchFrame, SketchIcon } from '@/shared/ui';

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
    <PaperBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={12}
            onPress={() => router.back()}
          >
            <SketchIcon name="back" size={26} color={colors.ink} />
          </Pressable>
          <Text style={styles.headerTitle}>Select Difficulty</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <SketchFrame fill={colors.surface} radius={radii.lg} seed={31}>
            <View style={styles.previewWrap}>
              {image != null ? (
                <Image
                  source={typeof image === 'number' ? image : { uri: image }}
                  style={styles.previewImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.previewFallback}>
                  <SketchIcon name="puzzle" size={64} color={colors.inkMuted} />
                </View>
              )}
            </View>
          </SketchFrame>

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
                  <SketchFrame
                    fill={active ? colors.gold : colors.surface}
                    stroke={colors.sketch}
                    radius={radii.md}
                    seed={size * 17 + 2}
                  >
                    <View style={styles.tileInner}>
                      <Text style={styles.tileCount}>{expectedPieceCount(size)}</Text>
                      <Text style={styles.tileTier}>
                        {tierFor(size)} · {size}×{size}
                      </Text>
                    </View>
                  </SketchFrame>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <SketchButton label="Start Puzzle" variant="primary" onPress={start} disabled={!puzzle} />
        </View>
      </SafeAreaView>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: { ...typography.title, color: colors.ink },
  headerSpacer: { width: 26 },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
  },
  previewWrap: {
    height: 200,
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: colors.kraft,
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
  tileInner: { alignItems: 'center', paddingVertical: spacing.md, gap: 2 },
  tileCount: { ...typography.title, fontSize: 32, color: colors.inkSoft },
  tileTier: { ...typography.label, color: colors.inkMuted },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
});
