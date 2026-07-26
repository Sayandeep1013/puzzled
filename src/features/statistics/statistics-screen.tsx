import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getProgressRepository, type PuzzleProgressSummary } from '@/data';
import { type GridSize } from '@/game-engine';
import { accentAt, colors, radii, spacing, typography } from '@/shared/theme';
import { PopHeader, PopSurface } from '@/shared/ui';

interface Stats {
  /** Count of saved sessions with `status === 'completed'` (one per puzzle+size). */
  completed: number;
  /** Sum of `lockedPieces` across every saved session. */
  piecesPlaced: number;
  /** Sum of `elapsedMs` across every saved session. */
  totalTimeMs: number;
  /** Fastest `elapsedMs` among completed sessions, or `null` with none completed. */
  bestTimeMs: number | null;
  /** The `gridSize` with the most saved sessions, or `null` with no sessions. */
  favouriteGridSize: GridSize | null;
}

const EMPTY_STATS: Stats = {
  completed: 0,
  piecesPlaced: 0,
  totalTimeMs: 0,
  bestTimeMs: null,
  favouriteGridSize: null,
};

function computeStats(rows: PuzzleProgressSummary[]): Stats {
  if (rows.length === 0) {
    return EMPTY_STATS;
  }

  const completed = rows.filter((row) => row.status === 'completed').length;
  const piecesPlaced = rows.reduce((sum, row) => sum + row.lockedPieces, 0);
  const totalTimeMs = rows.reduce((sum, row) => sum + row.elapsedMs, 0);

  const completedTimes = rows
    .filter((row) => row.status === 'completed')
    .map((row) => row.elapsedMs);
  const bestTimeMs = completedTimes.length > 0 ? Math.min(...completedTimes) : null;

  const sizeCounts = new Map<GridSize, number>();
  for (const row of rows) {
    sizeCounts.set(row.gridSize, (sizeCounts.get(row.gridSize) ?? 0) + 1);
  }
  let favouriteGridSize: GridSize | null = null;
  let favouriteCount = 0;
  for (const [size, count] of sizeCounts) {
    if (count > favouriteCount) {
      favouriteCount = count;
      favouriteGridSize = size;
    }
  }

  return { completed, piecesPlaced, totalTimeMs, bestTimeMs, favouriteGridSize };
}

/** mm:ss (or h:mm:ss past an hour) — for a single completion time. */
function formatClock(ms: number | null): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) {
    return '—';
  }
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** Coarser h/m readout — for a lifetime total across every session. */
function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds <= 0) {
    return '0m';
  }
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return `${totalSeconds}s`;
}

export function StatisticsScreen() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);

  // Refetch on focus so a puzzle just finished is reflected immediately.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const rows = await (
          await getProgressRepository()
        )
          .listSummaries()
          .catch(() => [] as PuzzleProgressSummary[]);
        if (active) setStats(computeStats(rows));
      })();
      return () => {
        active = false;
      };
    }, []),
  );

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <PopHeader title="Statistics" onBack={() => router.back()} />

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.grid}>
            <StatTile
              fill={accentAt(0)}
              value={String(stats.completed)}
              label="PUZZLES COMPLETED"
              style={styles.tileHalf}
            />
            <StatTile
              fill={accentAt(1)}
              value={String(stats.piecesPlaced)}
              label="PIECES PLACED"
              style={styles.tileHalf}
            />
            <StatTile
              fill={accentAt(2)}
              value={formatClock(stats.bestTimeMs)}
              label="BEST TIME"
              style={styles.tileHalf}
            />
            <StatTile
              fill={accentAt(3)}
              value={
                stats.favouriteGridSize != null
                  ? `${stats.favouriteGridSize}×${stats.favouriteGridSize}`
                  : '—'
              }
              label="FAVOURITE SIZE"
              style={styles.tileHalf}
            />
            <StatTile
              fill={accentAt(4)}
              value={formatDuration(stats.totalTimeMs)}
              label="TOTAL TIME PLAYED"
              style={styles.tileWide}
            />
          </View>

          {stats.completed === 0 ? (
            <Text style={styles.emptyHint}>
              Finish your first puzzle to start filling in these stats.
            </Text>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function StatTile({
  fill,
  value,
  label,
  style,
}: {
  fill: string;
  value: string;
  label: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <PopSurface fill={fill} radius={radii.lg} contentStyle={styles.tileFrame} style={style}>
      <View style={styles.tileBody}>
        <Text style={styles.tileValue}>{value}</Text>
        <Text style={styles.tileLabel}>{label}</Text>
      </View>
    </PopSurface>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  safeArea: { flex: 1 },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  tileHalf: { width: '47%' },
  tileWide: { width: '100%' },
  // Inset padding on the coloured `PopSurface` face, so a ring of `fill` shows
  // as a frame around the white tile body nested inside it.
  tileFrame: { padding: spacing.xs },
  tileBody: {
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radii.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  tileValue: { ...typography.title, fontSize: 28, color: colors.ink },
  tileLabel: { ...typography.label, fontSize: 11, color: colors.inkMuted, textAlign: 'center' },
  emptyHint: { ...typography.body, color: colors.inkMuted, textAlign: 'center' },
});
