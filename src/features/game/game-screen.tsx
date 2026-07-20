import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LocalPuzzleRepository } from '@/data';
import {
  countLockedPieces,
  createPlayablePuzzle,
  expectedPieceCount,
  type GameSession,
  type PlayablePuzzle,
} from '@/game-engine';
import { colors, spacing } from '@/shared/theme';

import { PuzzleBoard } from './puzzle-board';

const FIRST_LIGHT_IMAGE = require('../../../assets/puzzles/first-light.png');

interface GameScreenProps {
  puzzleId: string;
}

type LoadState =
  { status: 'loading' } | { status: 'missing' } | { status: 'ready'; playable: PlayablePuzzle };

export function GameScreen({ puzzleId }: GameScreenProps) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [session, setSession] = useState<GameSession | null>(null);

  useEffect(() => {
    let active = true;
    const repository = new LocalPuzzleRepository();

    repository.getById(puzzleId).then((puzzle) => {
      if (!active) {
        return;
      }

      if (!puzzle) {
        setState({ status: 'missing' });
        return;
      }

      const playable = createPlayablePuzzle({
        puzzle,
        sessionId: `local-${puzzle.id}`,
        now: new Date().toISOString(),
        cellSize: puzzle.gridSize <= 4 ? 72 : puzzle.gridSize <= 6 ? 56 : 44,
        layoutMode: 'tray',
      });

      setState({ status: 'ready', playable });
      setSession(playable.session);
    });

    return () => {
      active = false;
    };
  }, [puzzleId]);

  const onSessionChange = useCallback((next: GameSession) => {
    setSession(next);
  }, []);

  if (state.status === 'loading' || (state.status === 'ready' && !session)) {
    return (
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <View style={styles.content}>
          <Text style={styles.title}>Loading puzzle…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (state.status === 'missing') {
    return (
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <View style={styles.content}>
          <Text style={styles.title}>Puzzle not found</Text>
          <Text style={styles.meta}>No catalog entry for “{puzzleId}”.</Text>
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
          <View style={styles.counter}>
            <Text style={styles.counterValue}>
              {locked} / {total}
            </Text>
            <Text style={styles.counterLabel}>placed</Text>
          </View>
        </View>

        <View style={styles.boardShell}>
          <PuzzleBoard
            generated={generated}
            session={session}
            imageModule={FIRST_LIGHT_IMAGE}
            onSessionChange={onSessionChange}
          />
        </View>

        <Text style={styles.hint}>
          {complete
            ? 'Nice — every piece locked. Reset by leaving and starting again for now.'
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
  boardShell: {
    flex: 1,
    minHeight: 420,
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
