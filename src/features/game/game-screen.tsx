import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getProgressRepository, getPuzzleImageModule, LocalPuzzleRepository } from '@/data';
import {
  cellSizeForGrid,
  countLockedPieces,
  createPlayablePuzzle,
  expectedPieceCount,
  isSessionCompatible,
  isSupportedGridSize,
  SUPPORTED_GRID_SIZES,
  type GameSession,
  type GridSize,
  type PlayablePuzzle,
  type PuzzleDefinition,
} from '@/game-engine';
import { colors, radii, spacing } from '@/shared/theme';

import { PuzzleBoard } from './puzzle-board';

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

interface GameScreenProps {
  puzzleId: string;
  /** Optional starting size, e.g. from a "Continue" deep link. */
  initialGridSize?: GridSize;
}

type Catalog =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'missing-art' }
  | { status: 'ready'; puzzle: PuzzleDefinition; imageModule: number };

export function GameScreen({ puzzleId, initialGridSize }: GameScreenProps) {
  const [catalog, setCatalog] = useState<Catalog>({ status: 'loading' });
  const [gridSize, setGridSize] = useState<GridSize | null>(initialGridSize ?? null);
  const [playable, setPlayable] = useState<PlayablePuzzle | null>(null);
  const [session, setSession] = useState<GameSession | null>(null);
  /** Bumped on reset to force a fresh board with a freshly measured world. */
  const [generation, setGeneration] = useState(0);

  // Load the catalog entry + artwork once per puzzle.
  useEffect(() => {
    let active = true;

    (async () => {
      const puzzle = await new LocalPuzzleRepository().getById(puzzleId);
      if (!active) return;

      if (!puzzle) {
        setCatalog({ status: 'missing' });
        return;
      }

      const imageModule = getPuzzleImageModule(puzzle.id);
      if (imageModule === null) {
        setCatalog({ status: 'missing-art' });
        return;
      }

      setCatalog({ status: 'ready', puzzle, imageModule });
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

  const onSessionChange = useCallback((next: GameSession) => {
    setSession(next);
  }, []);

  const onSelectSize = useCallback(
    (next: GridSize) => {
      if (next === gridSize) {
        return;
      }
      if (pendingSave.current) {
        clearTimeout(pendingSave.current);
        pendingSave.current = null;
      }
      setGridSize(next);
    },
    [gridSize],
  );

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
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <View style={styles.content}>
          <Text style={styles.title}>
            {catalog.status === 'missing' ? 'Puzzle not found' : 'Artwork missing'}
          </Text>
          <Text style={styles.meta}>
            {catalog.status === 'missing'
              ? `No catalog entry for “${puzzleId}”.`
              : `“${puzzleId}” has no bundled image registered.`}
          </Text>
        </View>
      </SafeAreaView>
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
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <View style={styles.content}>
          <Text style={styles.title}>Loading puzzle…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { generated } = playable;
  const locked = countLockedPieces(session);
  const total = expectedPieceCount(gridSize);
  const complete = session.status === 'completed';

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <View style={styles.content}>
        <View style={styles.statusRow}>
          <View style={styles.heading}>
            <Text style={styles.eyebrow}>
              {complete ? 'COMPLETED' : 'DRAG PIECES TO THE BOARD'}
            </Text>
            <Text style={styles.title}>{catalog.puzzle.title}</Text>
          </View>
          <View style={styles.actions}>
            <View style={styles.counter}>
              <Text style={styles.counterValue}>
                {locked} / {total}
              </Text>
              <Text style={styles.counterLabel}>placed</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reset puzzle"
              onPress={onReset}
              style={({ pressed }) => [styles.resetButton, pressed && styles.resetButtonPressed]}
            >
              <Text style={styles.resetButtonText}>Reset</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.sizeRow}>
          <Text style={styles.sizeLabel}>SIZE</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.sizeChips}
          >
            {SUPPORTED_GRID_SIZES.map((size) => {
              const active = size === gridSize;
              return (
                <Pressable
                  key={size}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${size} by ${size}`}
                  onPress={() => onSelectSize(size)}
                  style={[styles.sizeChip, active && styles.sizeChipActive]}
                >
                  <Text style={[styles.sizeChipText, active && styles.sizeChipTextActive]}>
                    {size}×{size}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.boardShell}>
          <PuzzleBoard
            key={`${generated.puzzle.id}:${generated.puzzle.revision}:${gridSize}:${generation}`}
            generated={generated}
            session={session}
            imageModule={catalog.imageModule}
            onSessionChange={onSessionChange}
          />
        </View>

        <Text style={styles.hint}>
          {complete
            ? 'Nice — every piece locked. Tap Reset to shuffle, or pick a bigger size.'
            : `${total} pieces · drag one onto its spot; it snaps when close enough.`}
        </Text>
      </View>
    </SafeAreaView>
  );
}

// Kept exported for any caller still importing the old prop shape.
export function isPlayableGridSize(value: number): value is GridSize {
  return isSupportedGridSize(value);
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 900,
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  heading: {
    flex: 1,
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  title: {
    marginTop: 4,
    color: colors.ink,
    fontSize: 24,
    fontWeight: '800',
  },
  meta: {
    color: colors.inkMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  counter: {
    alignItems: 'flex-end',
  },
  counterValue: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '800',
  },
  counterLabel: {
    color: colors.inkMuted,
    fontSize: 12,
  },
  resetButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  resetButtonPressed: {
    backgroundColor: colors.sage,
  },
  resetButtonText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '800',
  },
  sizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  sizeLabel: {
    color: colors.inkMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  sizeChips: {
    gap: spacing.xs,
    paddingRight: spacing.sm,
  },
  sizeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  sizeChipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  sizeChipText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '800',
  },
  sizeChipTextActive: {
    color: colors.surfaceStrong,
  },
  boardShell: {
    flex: 1,
    // No hard minimum: the board scales to whatever height is left, so forcing a
    // large value only pushed the column past the screen on short devices.
    minHeight: 220,
    overflow: 'hidden',
    borderRadius: 24,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.line,
  },
  hint: {
    paddingHorizontal: spacing.sm,
    color: colors.inkMuted,
    fontSize: 13,
    lineHeight: 18,
  },
});
