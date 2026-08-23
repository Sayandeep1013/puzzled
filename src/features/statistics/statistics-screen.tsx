import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getCompletionsRepository,
  getProgressRepository,
  latestPerBoard,
  type PuzzleCompletion,
  type PuzzleProgressSummary,
} from '@/data';
import { formatClock } from '@/features/game/play-clock';
import { type GridSize } from '@/game-engine';
import { accentAt, radii, spacing, typography } from '@/shared/theme';
import { useTheme } from '@/shared/theme-context';
import { createThemedStyles } from '@/shared/themed-styles';
import { PopHeader, PopSurface, Text } from '@/shared/ui';

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
  /** Sum of `totalPieces` across every saved session. */
  totalPieces: number;
  /** `piecesPlaced / totalPieces` as a whole percent; 0 with no sessions. */
  percent: number;
}

const EMPTY_STATS: Stats = {
  completed: 0,
  piecesPlaced: 0,
  totalTimeMs: 0,
  bestTimeMs: null,
  favouriteGridSize: null,
  totalPieces: 0,
  percent: 0,
};

/**
 * `rows` is the live board state — pieces placed, time on the current attempt.
 * `completions` is the append-only history. The two are separate because a
 * replay overwrites the row: reading "puzzles completed" and "best time" off
 * `rows` meant both fell back the moment a finished puzzle was started again.
 */
export function computeStats(
  rows: PuzzleProgressSummary[],
  completions: PuzzleCompletion[],
): Stats {
  if (rows.length === 0 && completions.length === 0) {
    return EMPTY_STATS;
  }

  // Distinct boards finished — replaying one is not a second puzzle completed.
  const completed = latestPerBoard(completions).length;
  const piecesPlaced = rows.reduce((sum, row) => sum + row.lockedPieces, 0);
  const totalTimeMs = rows.reduce((sum, row) => sum + row.elapsedMs, 0);

  // Every attempt counts toward the best time, including a faster replay.
  const bestTimeMs =
    completions.length > 0 ? Math.min(...completions.map((entry) => entry.elapsedMs)) : null;

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

  const totalPieces = rows.reduce((sum, row) => sum + row.totalPieces, 0);
  const percent = totalPieces > 0 ? Math.round((piecesPlaced / totalPieces) * 100) : 0;

  return {
    completed,
    piecesPlaced,
    totalTimeMs,
    bestTimeMs,
    favouriteGridSize,
    totalPieces,
    percent,
  };
}

/**
 * mm:ss (or h:mm:ss past an hour) — for a single completion time.
 *
 * Delegates to the board's formatter rather than repeating it: this screen and
 * Results are two views of the same `session.elapsedMs`, and two copies of the
 * arithmetic is how they drifted apart in the first place. Only the "no data"
 * case is local, since a lifetime best time can genuinely be absent.
 */
function formatBestTime(ms: number | null): string {
  return ms == null || !Number.isFinite(ms) || ms < 0 ? '—' : formatClock(ms);
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
  const theme = useTheme();
  const styles = useStyles();
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
        const completions = await getCompletionsRepository()
          .then((repository) => repository.list())
          .catch(() => [] as PuzzleCompletion[]);
        if (active) setStats(computeStats(rows, completions));
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
          {/* Relocated from Home, which had grown into a dashboard. This screen
              already derived from the same progress rows, so it is where the
              overall figure belongs. */}
          <PopSurface
            fill={theme.colors.surface}
            radius={radii.lg}
            contentStyle={styles.progressBody}
          >
            <View style={styles.progressCopy}>
              <Text style={styles.progressLabel}>YOUR PROGRESS</Text>
              <Text style={styles.progressValue}>
                {stats.piecesPlaced} {stats.piecesPlaced === 1 ? 'piece' : 'pieces'} placed
              </Text>
              <Text style={styles.progressHint}>Saved on this device, even offline.</Text>
            </View>
            <ProgressRing percent={stats.percent} />
          </PopSurface>

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
              value={formatBestTime(stats.bestTimeMs)}
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

/**
 * The completion ring.
 *
 * It used to be a `View` with a plain 5px green `borderWidth` — a full circle,
 * always, with the real figure printed inside it. So a player at 4% saw what
 * looks like a completed ring next to the number 4%, which is worse than having
 * no ring at all: the one graphical element on the screen contradicted the data
 * beside it. `react-native-svg` is already a dependency (the board uses Skia,
 * but this is flat vector work), so the arc can simply be drawn.
 */
const RING_SIZE = 72;
const RING_STROKE = 6;

function ProgressRing({ percent }: { percent: number }) {
  const theme = useTheme();
  const styles = useStyles();
  const radius = (RING_SIZE - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = Math.min(1, Math.max(0, percent / 100));

  return (
    <View
      style={styles.progressRing}
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: percent }}
    >
      <Svg width={RING_SIZE} height={RING_SIZE}>
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={radius}
          fill="none"
          // The same sunken groove `PopProgress` uses, so the two read as one system.
          stroke="rgba(90, 62, 24, 0.14)"
          strokeWidth={RING_STROKE}
        />
        {fraction > 0 ? (
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={radius}
            fill="none"
            stroke={theme.colors.grass}
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            strokeDasharray={`${circumference * fraction} ${circumference}`}
            // Rotate so the arc starts at twelve o'clock rather than three.
            transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
          />
        ) : null}
      </Svg>
      <Text style={styles.progressPercent} numberOfLines={1}>
        {percent}%
      </Text>
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
  const styles = useStyles();
  return (
    <PopSurface fill={fill} radius={radii.lg} contentStyle={styles.tileFrame} style={style}>
      <View style={styles.tileBody}>
        <Text numberOfLines={1} style={styles.tileValue}>
          {value}
        </Text>
        <Text style={styles.tileLabel}>{label}</Text>
      </View>
    </PopSurface>
  );
}

const useStyles = createThemedStyles((theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.colors.paper },
    safeArea: { flex: 1 },
    content: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.xl,
      gap: spacing.md,
      width: '100%',
      maxWidth: 620,
      alignSelf: 'center',
    },
    progressBody: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      padding: spacing.lg,
    },
    progressCopy: { flex: 1, gap: 2 },
    progressLabel: { ...typography.label, color: theme.colors.inkMuted },
    progressValue: { ...typography.heading, color: theme.colors.ink },
    progressHint: { ...typography.caption, color: theme.colors.inkMuted },
    progressRing: {
      width: RING_SIZE,
      height: RING_SIZE,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Absolute, so it centres over the SVG rather than being laid out beside it.
    progressPercent: {
      ...typography.heading,
      fontSize: 17,
      color: theme.colors.ink,
      position: 'absolute',
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
      backgroundColor: theme.colors.surface,
    },
    tileValue: { ...typography.title, fontSize: 28, color: theme.colors.ink },
    tileLabel: {
      ...typography.label,
      fontSize: 11,
      color: theme.colors.inkMuted,
      textAlign: 'center',
    },
    emptyHint: { ...typography.body, color: theme.colors.inkMuted, textAlign: 'center' },
  }),
);
