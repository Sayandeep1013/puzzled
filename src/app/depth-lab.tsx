import { Canvas, Group, useImage } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getPuzzleImageModule } from '@/data/local/puzzle-assets';
import { buildPieceLocalPath, cellSizeForGrid } from '@/game-engine';
import { commandsToSkPath } from '@/game-engine/rendering';
import { PieceDepth, type DepthTreatment } from '@/features/game/piece-depth';
import { colors, spacing, typography } from '@/shared/theme';

/**
 * Dev-only comparison of the three piece-depth treatments.
 *
 * Exists because "this is achievable in code" had been asserted three times without
 * anything to look at. Each treatment renders the *same* piece over the *same* photo
 * at high zoom, so the difference is the treatment and nothing else. Reachable at
 * `puzzled://depth-lab`; nothing links to it.
 *
 * See `docs/superpowers/specs/2026-07-31-cardboard-piece-depth-design.md`.
 */

/** Zoomed hard: at real size a bevel is a couple of pixels and settles nothing. */
const ZOOM = 3.4;
const GRID = 4;
/** A tab on the right and bottom, a blank on the left — a typical interior piece. */
const EDGES = { top: 0, right: 1, bottom: 1, left: -1 } as const;

const TREATMENTS: { key: DepthTreatment; label: string; note: string }[] = [
  { key: 'current', label: 'Current', note: 'one blurred inward stroke' },
  { key: 'cardboard', label: 'Cardboard', note: 'lit bevel + light fibre core + grain' },
  { key: 'bevel', label: 'Bevel only', note: 'lit bevel, no light core' },
];

export default function DepthLabScreen() {
  const image = useImage(getPuzzleImageModule('first-light') ?? 0);

  const cellSize = cellSizeForGrid(GRID);
  const local = useMemo(
    () => buildPieceLocalPath(EDGES, { width: cellSize, height: cellSize }),
    [cellSize],
  );
  const path = useMemo(() => commandsToSkPath(local.commands), [local]);

  const { bounds } = local;
  const smallerBound = Math.min(bounds.width, bounds.height);
  const canvasW = bounds.width * ZOOM;
  const canvasH = bounds.height * ZOOM;
  // The piece samples the middle of the photo, so every treatment gets identical
  // pixels underneath and none of them wins on subject matter.
  const imageScale = image ? (cellSize * GRID) / image.width() : 1;
  // Sample the middle of the photo. Positive, because `PieceDepth` negates it to
  // shift the artwork — the first attempt had the sign inverted, which pushed the
  // photo's own top-left corner into the middle of the piece and left the rest of it
  // uncovered.
  const sourceX = cellSize * 1.5;
  const sourceY = cellSize * 1.5;

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Piece depth</Text>
          <Text style={styles.caption}>
            Same piece, same photo, {ZOOM}x zoom. Only the edge treatment differs.
          </Text>

          {!image ? (
            <Text style={styles.caption}>Loading image…</Text>
          ) : (
            TREATMENTS.map(({ key, label, note }) => (
              <View key={key} style={styles.row}>
                <Text style={styles.rowLabel}>{label}</Text>
                <Text style={styles.rowNote}>{note}</Text>
                <View style={styles.canvasWrap}>
                  <Canvas style={{ width: canvasW, height: canvasH }}>
                    <Group transform={[{ scale: ZOOM }]}>
                      <Group transform={[{ translateX: -bounds.x }, { translateY: -bounds.y }]}>
                        <PieceDepth
                          path={path}
                          image={image}
                          imageScale={imageScale}
                          smallerBound={smallerBound}
                          sourceX={sourceX}
                          sourceY={sourceY}
                          treatment={key}
                        />
                      </Group>
                    </Group>
                  </Canvas>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  safeArea: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.lg, alignItems: 'center' },
  title: { ...typography.title, color: colors.headingGreen },
  caption: { ...typography.caption, color: colors.inkMuted, textAlign: 'center' },
  row: { alignItems: 'center', gap: 2 },
  rowLabel: { ...typography.heading, color: colors.ink },
  rowNote: { ...typography.caption, color: colors.inkMuted },
  canvasWrap: {
    // Cream, like the board mat, so the drop shadow is visible against something.
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
});
