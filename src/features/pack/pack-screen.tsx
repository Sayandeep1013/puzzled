import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getProgressRepository,
  listCatalog,
  resolvePuzzleImageSource,
  type PuzzleProgressSummary,
} from '@/data';
import { type PuzzleDefinition } from '@/game-engine';
import { accentAt, backgrounds, colors, radii, shadow, spacing, typography } from '@/shared/theme';
import { Art, PopButton, PopHeader, PopSurface, Text } from '@/shared/ui';

/**
 * `PuzzleDefinition` has no pack/category field (see `puzzles-screen.tsx`'s
 * identical note), and there is no server-driven pack catalog in Phase 1.
 * The only honest grouping is "everything bundled with the app" — one real
 * pack, not several invented themed packs with no puzzles behind them.
 * Adding a real second pack later is a one-line addition here once there is
 * a real field (or a second bundle) to group by.
 */
interface PackDefinition {
  id: string;
  title: string;
  tagline: string;
}

const PACKS: Record<string, PackDefinition> = {
  starter: { id: 'starter', title: 'Starter Pack', tagline: 'Every puzzle bundled with Puzzled.' },
};

interface PackData {
  puzzles: PuzzleDefinition[];
  /** All saved sessions for a puzzle, most recently played first. */
  byPuzzle: Record<string, PuzzleProgressSummary[]>;
}

const EMPTY: PackData = { puzzles: [], byPuzzle: {} };

async function loadPackData(): Promise<PackData> {
  const { bundled } = await listCatalog();

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

  return { puzzles: bundled, byPuzzle };
}

export function PackScreen({ packId }: { packId: string }) {
  const router = useRouter();
  const [data, setData] = useState<PackData>(EMPTY);
  const pack = PACKS[packId] ?? null;

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadPackData().then((next) => {
        if (active) setData(next);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <PopHeader
          title={pack?.title ?? 'Pack'}
          onBack={() => router.back()}
          titleColor={colors.onFill}
        />
        <ScrollView contentContainerStyle={styles.content}>
          {pack == null ? (
            <Text style={styles.empty}>This pack doesn&apos;t exist yet.</Text>
          ) : (
            <>
              <View style={styles.hero}>
                <View style={styles.heroIconWrap}>
                  <Art name="collection" size={34} />
                </View>
                <View style={styles.heroCopy}>
                  <Text style={styles.tagline}>{pack.tagline}</Text>
                  <Text style={styles.sectionMeta}>
                    {data.puzzles.length} {data.puzzles.length === 1 ? 'puzzle' : 'puzzles'} · all
                    unlocked
                  </Text>
                </View>
              </View>

              {data.puzzles.length === 0 ? (
                <Text style={styles.empty}>No puzzles in this pack yet.</Text>
              ) : (
                data.puzzles.map((puzzle, index) => (
                  <PackPuzzleRow
                    key={puzzle.id}
                    puzzle={puzzle}
                    rows={data.byPuzzle[puzzle.id] ?? []}
                    fill={accentAt(index)}
                  />
                ))
              )}

              {/* One bundled puzzle leaves most of the screen blank; the mascot
                  closes the tail rather than leaving it looking unfinished. */}
              <View style={styles.footerArt}>
                <Art name="bear-excited" size={128} />
                <Text style={styles.footerNote}>More packs are on the way.</Text>
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function PackPuzzleRow({
  puzzle,
  rows,
  fill,
}: {
  puzzle: PuzzleDefinition;
  rows: PuzzleProgressSummary[];
  /** Deterministic per-position accent from `accentAt` — the colour frame around the row. */
  fill: string;
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
  const source = resolvePuzzleImageSource(puzzle);

  return (
    <PopSurface fill={fill} radius={radii.md} contentStyle={styles.rowFrame}>
      <View style={styles.rowBody}>
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
            {puzzle.title}
          </Text>
          <Text style={styles.rowMeta}>
            {started
              ? `${latest.gridSize}×${latest.gridSize} · ${latest.lockedPieces}/${latest.totalPieces} placed`
              : 'Choose 3×3 up to 10×10'}
          </Text>
        </View>
        <PopButton
          label={done ? 'Play again' : started ? 'Continue' : 'Start'}
          tone="grass"
          size="sm"
          // Must track the visible label — it read "Start"/"Continue" while the
          // button said "Play again", so screen-reader users were told the wrong
          // action on every completed puzzle.
          accessibilityLabel={`${done ? 'Play again' : started ? 'Continue' : 'Start'} ${puzzle.title} puzzle`}
          onPress={() => router.push(href)}
        />
      </View>
    </PopSurface>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: backgrounds.pack },
  safe: { flex: 1 },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  heroIconWrap: {
    width: 56,
    height: 56,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    boxShadow: shadow.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCopy: { flex: 1, gap: 2 },
  // The pack ground is saturated mint, so copy over it goes white.
  tagline: { ...typography.heading, fontSize: 18, color: colors.onFill },
  // Both sit directly on the mint ground, not inside a card.
  sectionMeta: { ...typography.caption, color: colors.onFill },
  empty: { ...typography.body, color: colors.onFill, paddingVertical: spacing.lg },
  footerArt: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.xl },
  footerNote: { ...typography.caption, color: colors.onFill, textAlign: 'center' },
  // Inset padding on the coloured `PopSurface` face, so a ring of `fill` shows
  // as a frame around the white row body nested inside it (the
  // `home-screen.tsx` `PuzzleCard` pattern).
  rowFrame: { padding: spacing.xs },
  rowBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: radii.sm,
    overflow: 'hidden',
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImage: { width: '100%', height: '100%' },
  rowCopy: { flex: 1, gap: 2 },
  rowTitle: { ...typography.heading, fontSize: 17, color: colors.ink },
  rowMeta: { ...typography.caption, color: colors.inkMuted },
});
