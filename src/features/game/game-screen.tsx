import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getProgressRepository, getPuzzleImageModule, LocalPuzzleRepository } from '@/data';
import {
  cellSizeForGrid,
  countLockedPieces,
  createPlayablePuzzle,
  expectedPieceCount,
  isSessionCompatible,
  type GameSession,
  type PlayablePuzzle,
  type PuzzleDefinition,
} from '@/game-engine';
import { colors, radii, spacing } from '@/shared/theme';

import { PuzzleBoard } from './puzzle-board';

function buildPlayable(puzzle: PuzzleDefinition): PlayablePuzzle {
  return createPlayablePuzzle({
    puzzle,
    sessionId: `local-${puzzle.id}`,
    now: new Date().toISOString(),
    cellSize: cellSizeForGrid(puzzle.gridSize),
    layoutMode: 'tray',
  });
}

interface GameScreenProps {
  puzzleId: string;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'missing-art' }
  | { status: 'ready'; playable: PlayablePuzzle; puzzle: PuzzleDefinition; imageModule: number };

export function GameScreen({ puzzleId }: GameScreenProps) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [session, setSession] = useState<GameSession | null>(null);
  /** Bumped on reset to force a fresh board with a fresh measured world. */
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    let active = true;

    (async () => {
      const puzzle = await new LocalPuzzleRepository().getById(puzzleId);
      if (!active) return;

      if (!puzzle) {
        setState({ status: 'missing' });
        return;
      }

      const imageModule = getPuzzleImageModule(puzzle.id);
      if (imageModule === null) {
        setState({ status: 'missing-art' });
        return;
      }

      const playable = buildPlayable(puzzle);

      // Resume only when the stored board still matches the generated one.
      let restored: GameSession | null = null;
      try {
        const saved = await (await getProgressRepository()).getSession(puzzle.id);
        if (saved && isSessionCompatible(saved, puzzle, playable.generated.pieces)) {
          restored = saved;
        }
      } catch {
        // A progress read failure must not block play; fall back to a new board.
      }

      if (!active) return;

      setState({ status: 'ready', playable, puzzle, imageModule });
      setSession(restored ?? playable.session);
    })();

    return () => {
      active = false;
    };
  }, [puzzleId]);

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

  const onReset = useCallback(() => {
    if (state.status !== 'ready') {
      return;
    }

    if (pendingSave.current) {
      clearTimeout(pendingSave.current);
      pendingSave.current = null;
    }

    const playable = buildPlayable(state.puzzle);
    setState({ ...state, playable });
    setSession(playable.session);
    setGeneration((value) => value + 1);

    void (async () => {
      try {
        await (await getProgressRepository()).deleteSession(state.puzzle.id);
      } catch {
        // Local board is already reset; a stale row will be overwritten on next save.
      }
    })();
  }, [state]);

  if (state.status === 'loading' || (state.status === 'ready' && !session)) {
    return (
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <View style={styles.content}>
          <Text style={styles.title}>Loading puzzle…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (state.status === 'missing' || state.status === 'missing-art') {
    return (
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <View style={styles.content}>
          <Text style={styles.title}>
            {state.status === 'missing' ? 'Puzzle not found' : 'Artwork missing'}
          </Text>
          <Text style={styles.meta}>
            {state.status === 'missing'
              ? `No catalog entry for “${puzzleId}”.`
              : `“${puzzleId}” has no bundled image registered.`}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const { generated } = state.playable;
  if (!session) {
    return null;
  }

  const locked = countLockedPieces(session);
  const total = expectedPieceCount(session.gridSize);
  const complete = session.status === 'completed';

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <View style={styles.content}>
        <View style={styles.statusRow}>
          <View style={styles.heading}>
            <Text style={styles.eyebrow}>
              {complete ? 'COMPLETED' : 'DRAG PIECES TO THE BOARD'}
            </Text>
            <Text style={styles.title}>{generated.puzzle.title}</Text>
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

        <View style={styles.boardShell}>
          <PuzzleBoard
            key={`${generated.puzzle.id}:${generated.puzzle.revision}:${generation}`}
            generated={generated}
            session={session}
            imageModule={state.imageModule}
            onSessionChange={onSessionChange}
          />
        </View>

        <Text style={styles.hint}>
          {complete
            ? 'Nice — every piece locked. Tap Reset to shuffle and play again.'
            : 'Pieces start in the tray below. Drag one onto its spot; it snaps when close enough.'}
        </Text>
      </View>
    </SafeAreaView>
  );
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
  boardShell: {
    flex: 1,
    // No hard minimum: the board scales to whatever height is left, so forcing
    // 420 here only pushed the column past the screen on short devices.
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
