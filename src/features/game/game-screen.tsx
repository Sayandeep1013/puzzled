import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Image as RNImage, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getProgressRepository, getPuzzleById, resolvePuzzleImageSource } from '@/data';
import {
  cellSizeForGrid,
  countLockedPieces,
  createPlayablePuzzle,
  expectedPieceCount,
  isSessionCompatible,
  isSupportedGridSize,
  type GameSession,
  type GridSize,
  type PlayablePuzzle,
  type PuzzleDefinition,
} from '@/game-engine';
import { colors, radii, spacing, typography } from '@/shared/theme';
import {
  PaperBackground,
  SketchButton,
  SketchFrame,
  SketchIcon,
  SketchToggle,
  type IconName,
} from '@/shared/ui';

import { FX } from './board-fx';
import { PuzzleBoard } from './puzzle-board';

type OverlayKind = 'none' | 'pause' | 'hint' | 'preview';

function buildPlayable(puzzle: PuzzleDefinition, gridSize: GridSize): PlayablePuzzle {
  const sized: PuzzleDefinition = { ...puzzle, gridSize };
  return createPlayablePuzzle({
    puzzle: sized,
    sessionId: `local-${puzzle.id}-${gridSize}`,
    now: new Date().toISOString(),
    cellSize: cellSizeForGrid(gridSize),
    layoutMode: 'tray',
  });
}

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

interface GameScreenProps {
  puzzleId: string;
  /** Optional starting size, e.g. from a "Continue" deep link. */
  initialGridSize?: GridSize;
}

type CatalogState =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'missing-art' }
  | { status: 'ready'; puzzle: PuzzleDefinition; imageSource: number | string };

export function GameScreen({ puzzleId, initialGridSize }: GameScreenProps) {
  const router = useRouter();
  const [catalog, setCatalog] = useState<CatalogState>({ status: 'loading' });
  const [gridSize, setGridSize] = useState<GridSize | null>(initialGridSize ?? null);
  const [playable, setPlayable] = useState<PlayablePuzzle | null>(null);
  const [session, setSession] = useState<GameSession | null>(null);
  /** Bumped on reset to force a fresh board with a freshly measured world. */
  const [generation, setGeneration] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [overlay, setOverlay] = useState<OverlayKind>('none');
  const [sound, setSound] = useState(true);
  const [music, setMusic] = useState(true);
  const [highlightEdges, setHighlightEdges] = useState(false);

  // Load the catalog entry + artwork once per puzzle.
  useEffect(() => {
    let active = true;

    (async () => {
      const puzzle = await getPuzzleById(puzzleId);
      if (!active) return;

      if (!puzzle) {
        setCatalog({ status: 'missing' });
        return;
      }

      const imageSource = resolvePuzzleImageSource(puzzle);
      if (imageSource == null) {
        setCatalog({ status: 'missing-art' });
        return;
      }

      setCatalog({ status: 'ready', puzzle, imageSource });
      // Default to the requested size, else the catalog's own size.
      setGridSize((current) => current ?? puzzle.gridSize);
    })();

    return () => {
      active = false;
    };
  }, [puzzleId]);

  // Build the board and load saved progress whenever the puzzle or size changes.
  useEffect(() => {
    if (catalog.status !== 'ready' || gridSize == null) {
      return;
    }

    let active = true;
    const { puzzle } = catalog;
    const built = buildPlayable(puzzle, gridSize);

    (async () => {
      let restored: GameSession | null = null;
      try {
        const saved = await (await getProgressRepository()).getSession(puzzle.id, gridSize);
        if (saved && isSessionCompatible(saved, built.generated.puzzle, built.generated.pieces)) {
          restored = saved;
        }
      } catch {
        // A progress read failure must not block play; fall back to a new board.
      }

      if (!active) return;
      setPlayable(built);
      setSession(restored ?? built.session);
    })();

    return () => {
      active = false;
    };
  }, [catalog, gridSize]);

  // Debounced write-behind: dragging produces a session object per drop.
  const pendingSave = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!session || session.status === 'not-started') {
      return;
    }

    if (pendingSave.current) {
      clearTimeout(pendingSave.current);
    }

    pendingSave.current = setTimeout(() => {
      void (async () => {
        try {
          await (await getProgressRepository()).saveSession(session);
        } catch {
          // Progress is best-effort; a failed write should never interrupt play.
        }
      })();
    }, 400);

    return () => {
      if (pendingSave.current) {
        clearTimeout(pendingSave.current);
      }
    };
  }, [session]);

  const complete = session?.status === 'completed';

  // Tick a play clock while the board is live, unfinished, and not paused.
  useEffect(() => {
    if (!playable || complete || overlay === 'pause') {
      return;
    }
    const id = setInterval(() => setElapsed((v) => v + 1), 1000);
    return () => clearInterval(id);
  }, [playable, complete, generation, overlay]);

  // On completion, hand off to the results screen once — but only after a short
  // beat so the board's celebration (confetti + success haptic) is actually seen.
  const handedOff = useRef(false);
  useEffect(() => {
    if (!complete || handedOff.current || catalog.status !== 'ready' || gridSize == null) {
      return;
    }
    handedOff.current = true;
    const puzzleId = catalog.puzzle.id;
    const timer = setTimeout(() => {
      router.push({
        pathname: '/results/[puzzleId]',
        params: {
          puzzleId,
          size: String(gridSize),
          time: String(elapsed),
        },
      });
    }, FX.celebrateMs);
    return () => clearTimeout(timer);
  }, [complete, catalog, gridSize, elapsed, router]);

  const onSessionChange = useCallback((next: GameSession) => {
    setSession(next);
  }, []);

  const onReset = useCallback(() => {
    if (catalog.status !== 'ready' || gridSize == null) {
      return;
    }

    if (pendingSave.current) {
      clearTimeout(pendingSave.current);
      pendingSave.current = null;
    }

    const fresh = buildPlayable(catalog.puzzle, gridSize);
    setPlayable(fresh);
    setSession(fresh.session);
    setGeneration((value) => value + 1);
    setElapsed(0);
    handedOff.current = false;

    void (async () => {
      try {
        await (await getProgressRepository()).deleteSession(catalog.puzzle.id, gridSize);
      } catch {
        // Local board is already reset; a stale row is overwritten on the next save.
      }
    })();
  }, [catalog, gridSize]);

  if (catalog.status === 'missing' || catalog.status === 'missing-art') {
    return (
      <PaperBackground>
        <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
          <View style={styles.centered}>
            <Text style={styles.bigTitle}>
              {catalog.status === 'missing' ? 'Puzzle not found' : 'Artwork missing'}
            </Text>
            <Text style={styles.meta}>
              {catalog.status === 'missing'
                ? `No catalog entry for “${puzzleId}”.`
                : `“${puzzleId}” has no bundled image registered.`}
            </Text>
          </View>
        </SafeAreaView>
      </PaperBackground>
    );
  }

  // Until the rebuilt board and the selected size agree, keep showing the loader —
  // otherwise a size switch briefly renders the new count over the old geometry.
  if (
    catalog.status !== 'ready' ||
    !playable ||
    !session ||
    gridSize == null ||
    playable.generated.puzzle.gridSize !== gridSize
  ) {
    return (
      <PaperBackground>
        <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
          <View style={styles.centered}>
            <Text style={styles.bigTitle}>Loading puzzle…</Text>
          </View>
        </SafeAreaView>
      </PaperBackground>
    );
  }

  const { generated } = playable;
  const locked = countLockedPieces(session);
  const total = expectedPieceCount(gridSize);

  return (
    <PaperBackground>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={12}
              onPress={() => router.back()}
            >
              <SketchIcon name="back" size={26} color={colors.ink} />
            </Pressable>

            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {catalog.puzzle.title}
              </Text>
              <Text style={styles.headerMeta}>
                {locked} / {total} placed
              </Text>
            </View>

            <View style={styles.headerRight}>
              <SketchFrame fill={colors.surface} radius={radii.md} seed={71}>
                <Text style={styles.clock}>{formatClock(elapsed)}</Text>
              </SketchFrame>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Pause"
                hitSlop={10}
                onPress={() => setOverlay('pause')}
              >
                <SketchIcon name="gear" size={26} color={colors.ink} />
              </Pressable>
            </View>
          </View>

          <View style={styles.boardShell}>
            <PuzzleBoard
              key={`${generated.puzzle.id}:${generated.puzzle.revision}:${gridSize}:${generation}`}
              generated={generated}
              session={session}
              imageSource={catalog.imageSource}
              onSessionChange={onSessionChange}
              highlightEdges={highlightEdges}
            />
          </View>

          <View style={styles.toolbar}>
            <ToolButton icon="back" label="Back" onPress={() => router.back()} />
            <ToolButton
              icon="puzzle"
              label="Edges"
              active={highlightEdges}
              onPress={() => setHighlightEdges((on) => !on)}
            />
            <ToolButton icon="sparkle" label="Hint" onPress={() => setOverlay('hint')} />
            <ToolButton icon="eye" label="Preview" onPress={() => setOverlay('preview')} />
          </View>
        </View>

        {overlay === 'pause' ? (
          <GameOverlay onDismiss={() => setOverlay('none')}>
            <Text style={styles.overlayTitle}>Paused</Text>
            <View style={styles.pauseRows}>
              <SettingRow label="Sound">
                <SketchToggle value={sound} onChange={setSound} accessibilityLabel="Sound" />
              </SettingRow>
              <SettingRow label="Music">
                <SketchToggle value={music} onChange={setMusic} accessibilityLabel="Music" />
              </SettingRow>
            </View>
            <SketchButton label="Resume" variant="primary" onPress={() => setOverlay('none')} />
            <SketchButton
              label="Restart"
              variant="gold"
              onPress={() => {
                setOverlay('none');
                onReset();
              }}
            />
            <SketchButton
              label="Exit Puzzle"
              variant="plain"
              onPress={() => {
                setOverlay('none');
                router.back();
              }}
            />
          </GameOverlay>
        ) : null}

        {overlay === 'hint' ? (
          <GameOverlay onDismiss={() => setOverlay('none')}>
            <Text style={styles.overlayTitle}>Hint</Text>
            <View style={styles.hintPiece}>
              <SketchIcon name="puzzle" size={80} color={colors.gold} strokeWidth={2.4} />
            </View>
            <SketchFrame fill={colors.sage} radius={radii.md} seed={44}>
              <Text style={styles.hintText}>
                Look for a corner piece first — its two flat edges make it easy to place.
              </Text>
            </SketchFrame>
            <SketchButton label="Okay" variant="primary" onPress={() => setOverlay('none')} />
          </GameOverlay>
        ) : null}

        {overlay === 'preview' ? (
          <GameOverlay onDismiss={() => setOverlay('none')}>
            <Text style={styles.overlayTitle}>Preview</Text>
            <SketchFrame fill={colors.kraft} radius={radii.md} seed={55}>
              <View style={styles.previewImageWrap}>
                <RNImage
                  source={
                    typeof catalog.imageSource === 'number'
                      ? catalog.imageSource
                      : { uri: catalog.imageSource }
                  }
                  style={styles.previewImage}
                  resizeMode="cover"
                />
              </View>
            </SketchFrame>
            <SketchButton label="Close" variant="primary" onPress={() => setOverlay('none')} />
          </GameOverlay>
        ) : null}
      </SafeAreaView>
    </PaperBackground>
  );
}

function GameOverlay({ children, onDismiss }: { children: ReactNode; onDismiss: () => void }) {
  return (
    <View style={styles.scrim}>
      <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Dismiss" onPress={onDismiss} />
      <SketchFrame fill={colors.canvas} radius={radii.lg} seed={200} style={styles.overlayCard}>
        <View style={styles.overlayInner}>{children}</View>
      </SketchFrame>
    </View>
  );
}

function SettingRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.settingRow}>
      <Text style={styles.settingLabel}>{label}</Text>
      {children}
    </View>
  );
}

function ToolButton({
  icon,
  label,
  onPress,
  disabled,
  active,
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  const tint = disabled ? colors.inkMuted : active ? colors.accent : colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, disabled }}
      onPress={onPress}
      disabled={disabled}
      style={[styles.tool, disabled && styles.toolDisabled]}
    >
      <SketchIcon name={icon} size={24} color={tint} />
      <Text style={[styles.toolLabel, active && { color: colors.accent }]}>{label}</Text>
    </Pressable>
  );
}

// Kept exported for any caller still importing the old prop shape.
export function isPlayableGridSize(value: number): value is GridSize {
  return isSupportedGridSize(value);
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.lg },
  bigTitle: { ...typography.title, color: colors.ink },
  meta: { ...typography.body, color: colors.inkMuted, textAlign: 'center' },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 900,
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { ...typography.heading, color: colors.ink },
  headerMeta: { ...typography.caption, color: colors.inkMuted },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  clock: {
    ...typography.bodyStrong,
    color: colors.inkSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  boardShell: {
    flex: 1,
    minHeight: 220,
    overflow: 'hidden',
    borderRadius: 24,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 2,
    borderColor: colors.sketch,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  tool: { alignItems: 'center', gap: 3, paddingHorizontal: spacing.sm },
  toolDisabled: { opacity: 0.45 },
  toolLabel: { ...typography.caption, fontSize: 11, color: colors.ink },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(23,33,33,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  overlayCard: { width: '100%', maxWidth: 380 },
  overlayInner: { padding: spacing.lg, gap: spacing.md },
  overlayTitle: { ...typography.title, color: colors.ink, textAlign: 'center' },
  pauseRows: { gap: spacing.sm },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  settingLabel: { ...typography.heading, fontSize: 18, color: colors.ink },
  hintPiece: { alignItems: 'center', paddingVertical: spacing.sm },
  hintText: {
    ...typography.body,
    color: colors.inkSoft,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  previewImageWrap: {
    height: 240,
    borderRadius: radii.md,
    overflow: 'hidden',
    margin: spacing.xs,
  },
  previewImage: { width: '100%', height: '100%' },
});
