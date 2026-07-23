import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getProgressRepository,
  listCatalog,
  resolvePuzzleImageSource,
  type PuzzleProgressSummary,
} from '@/data';
import { type PuzzleDefinition } from '@/game-engine';
import { colors, radii, spacing, typography } from '@/shared/theme';
import { PaperBackground, SketchFrame, SketchIcon } from '@/shared/ui';

type Tab = 'progress' | 'completed' | 'favorites';

interface Row extends PuzzleProgressSummary {
  puzzle?: PuzzleDefinition;
}

export function LibraryScreen() {
  const [tab, setTab] = useState<Tab>('progress');
  const [rows, setRows] = useState<Row[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [{ bundled, user }, summaries] = await Promise.all([
          listCatalog(),
          (await getProgressRepository())
            .listSummaries()
            .catch(() => [] as PuzzleProgressSummary[]),
        ]);
        const byId = new Map<string, PuzzleDefinition>();
        for (const puzzle of [...bundled, ...user]) byId.set(puzzle.id, puzzle);
        if (active) {
          setRows(summaries.map((s) => ({ ...s, puzzle: byId.get(s.puzzleId) })));
        }
      })();
      return () => {
        active = false;
      };
    }, []),
  );

  const inProgress = rows.filter((r) => r.status !== 'completed' && r.lockedPieces > 0);
  const completed = rows.filter((r) => r.status === 'completed');
  const visible = tab === 'progress' ? inProgress : tab === 'completed' ? completed : [];

  return (
    <PaperBackground>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Text style={styles.pageTitle}>My Library</Text>

        <View style={styles.tabs}>
          {(
            [
              ['progress', 'In Progress'],
              ['completed', 'Completed'],
              ['favorites', 'Favorites'],
            ] as [Tab, string][]
          ).map(([key, label]) => {
            const active = tab === key;
            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setTab(key)}
                style={styles.tab}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
                {active ? <View style={styles.tabUnderline} /> : null}
              </Pressable>
            );
          })}
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {tab === 'favorites' ? (
            <EmptyState
              icon="heart"
              text="No favorites yet"
              sub="Favoriting puzzles is coming soon."
            />
          ) : visible.length === 0 ? (
            <EmptyState
              icon="library"
              text={tab === 'progress' ? 'Nothing in progress' : 'No completed puzzles yet'}
              sub="Start a puzzle from Home or Explore."
            />
          ) : (
            visible.map((row) => <LibraryRow key={`${row.puzzleId}-${row.gridSize}`} row={row} />)
          )}
        </ScrollView>
      </SafeAreaView>
    </PaperBackground>
  );
}

function LibraryRow({ row }: { row: Row }) {
  const pct = row.totalPieces > 0 ? Math.round((row.lockedPieces / row.totalPieces) * 100) : 0;
  const source = row.puzzle ? resolvePuzzleImageSource(row.puzzle) : null;
  const done = row.status === 'completed';

  return (
    <Link
      href={{
        pathname: '/game/[puzzleId]',
        params: { puzzleId: row.puzzleId, size: String(row.gridSize) },
      }}
      asChild
    >
      <Pressable accessibilityRole="button">
        <SketchFrame fill={colors.surface} radius={radii.md} seed={row.puzzleId.length * 6 + row.gridSize}>
          <View style={styles.row}>
            <View style={styles.thumb}>
              {source != null ? (
                <Image
                  source={typeof source === 'number' ? source : { uri: source }}
                  style={styles.thumbImage}
                  resizeMode="cover"
                />
              ) : (
                <SketchIcon name="puzzle" size={28} color={colors.inkMuted} />
              )}
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {row.puzzle?.title ?? row.puzzleId}
              </Text>
              <Text style={styles.rowMeta}>
                {row.gridSize}×{row.gridSize} · {done ? 'Completed' : `${pct}%`}
              </Text>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${done ? 100 : pct}%` }]} />
              </View>
            </View>
            <SketchIcon name="chevron" size={20} color={colors.inkMuted} />
          </View>
        </SketchFrame>
      </Pressable>
    </Link>
  );
}

function EmptyState({ icon, text, sub }: { icon: 'heart' | 'library'; text: string; sub: string }) {
  return (
    <View style={styles.emptyWrap}>
      <SketchIcon name={icon} size={48} color={colors.inkMuted} />
      <Text style={styles.emptyTitle}>{text}</Text>
      <Text style={styles.emptySub}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  pageTitle: { ...typography.title, color: colors.ink, marginTop: spacing.sm, paddingHorizontal: spacing.lg },
  tabs: { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: spacing.lg, marginTop: spacing.sm },
  tab: { paddingVertical: spacing.xs, alignItems: 'center', gap: 4 },
  tabText: { ...typography.bodyStrong, color: colors.inkMuted },
  tabTextActive: { color: colors.ink },
  tabUnderline: { height: 3, width: '100%', borderRadius: 2, backgroundColor: colors.primary },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: radii.sm,
    overflow: 'hidden',
    backgroundColor: colors.kraft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImage: { width: '100%', height: '100%' },
  rowBody: { flex: 1, gap: 4 },
  rowTitle: { ...typography.heading, fontSize: 18, color: colors.ink },
  rowMeta: { ...typography.caption, color: colors.inkMuted },
  track: {
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.kraft,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: colors.gold },
  emptyWrap: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
  emptyTitle: { ...typography.heading, color: colors.ink, marginTop: spacing.sm },
  emptySub: { ...typography.body, color: colors.inkMuted, textAlign: 'center' },
});
