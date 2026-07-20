import { generatePuzzlePieces } from './generate';
import { createInitialPositions } from './layout';
import {
  countLockedPieces,
  createInitialSession,
  dropPiece,
  isSessionComplete,
  isWithinSnapDistance,
  raisePiece,
  snapThresholdForCellSize,
} from './session';
import type { PuzzleDefinition } from './types';

const puzzle: PuzzleDefinition = {
  id: 'first-light',
  title: 'First Light',
  image: {
    uri: 'asset://first-light',
    pixelSize: { width: 1200, height: 1200 },
  },
  gridSize: 8,
  seed: 'first-light-v1',
  revision: 1,
};

describe('game session primitives', () => {
  const generated = generatePuzzlePieces({ puzzle, cellSize: 50 });
  const initialPositions = createInitialPositions({
    pieces: generated.pieces,
    boardSize: generated.boardSize,
    mode: 'tray',
    seed: puzzle.seed,
  });

  it('creates a serializable local-first session', () => {
    const session = createInitialSession({
      sessionId: 'session-1',
      puzzle,
      pieces: generated.pieces,
      initialPositions,
      now: '2026-07-20T00:00:00.000Z',
    });

    expect(session.pieces).toHaveLength(64);
    expect(session.status).toBe('not-started');
    expect(session.syncState).toBe('local');
    expect(countLockedPieces(session)).toBe(0);
    expect(session.pieces[0].position).toEqual(initialPositions['0:0']);
  });

  it('includes the exact boundary in the snap distance', () => {
    expect(isWithinSnapDistance({ x: 3, y: 4 }, { x: 0, y: 0 }, 5)).toBe(true);
    expect(isWithinSnapDistance({ x: 3, y: 4.01 }, { x: 0, y: 0 }, 5)).toBe(false);
  });

  it('rejects a negative snap threshold', () => {
    expect(() => isWithinSnapDistance({ x: 0, y: 0 }, { x: 0, y: 0 }, -1)).toThrow(RangeError);
  });

  it('raises unlocked pieces above the current max z-index', () => {
    const session = createInitialSession({
      sessionId: 'session-1',
      puzzle,
      pieces: generated.pieces,
      initialPositions,
      now: '2026-07-20T00:00:00.000Z',
    });

    const raised = raisePiece(session, '1:1', '2026-07-20T00:00:01.000Z');
    const maxZ = Math.max(...raised.pieces.map((piece) => piece.zIndex));
    expect(raised.pieces.find((piece) => piece.pieceId === '1:1')?.zIndex).toBe(maxZ);
  });

  it('snaps and locks a piece inside the threshold', () => {
    const session = createInitialSession({
      sessionId: 'session-1',
      puzzle,
      pieces: generated.pieces,
      initialPositions,
      now: '2026-07-20T00:00:00.000Z',
    });
    const geometry = generated.pieces[0];
    const threshold = snapThresholdForCellSize(50);

    const next = dropPiece({
      session,
      pieceId: geometry.id,
      position: { x: geometry.solvedPosition.x + threshold / 2, y: geometry.solvedPosition.y },
      solvedPosition: geometry.solvedPosition,
      now: '2026-07-20T00:00:02.000Z',
      elapsedMs: 2000,
      snapThreshold: threshold,
    });

    const piece = next.pieces.find((entry) => entry.pieceId === geometry.id);
    expect(piece?.isLocked).toBe(true);
    expect(piece?.position).toEqual(geometry.solvedPosition);
    expect(next.status).toBe('in-progress');
    expect(next.elapsedMs).toBe(2000);
  });

  it('keeps a far drop unlocked at the released position', () => {
    const session = createInitialSession({
      sessionId: 'session-1',
      puzzle,
      pieces: generated.pieces,
      initialPositions,
      now: '2026-07-20T00:00:00.000Z',
    });
    const geometry = generated.pieces[0];
    const dropAt = { x: 300, y: 300 };

    const next = dropPiece({
      session,
      pieceId: geometry.id,
      position: dropAt,
      solvedPosition: geometry.solvedPosition,
      now: '2026-07-20T00:00:03.000Z',
      elapsedMs: 3000,
      snapThreshold: snapThresholdForCellSize(50),
    });

    const piece = next.pieces.find((entry) => entry.pieceId === geometry.id);
    expect(piece?.isLocked).toBe(false);
    expect(piece?.position).toEqual(dropAt);
    expect(isSessionComplete(next)).toBe(false);
  });

  it('marks the session completed when the final piece locks', () => {
    let session = createInitialSession({
      sessionId: 'session-1',
      puzzle,
      pieces: generated.pieces,
      initialPositions,
      now: '2026-07-20T00:00:00.000Z',
    });

    const threshold = snapThresholdForCellSize(50);

    for (const geometry of generated.pieces) {
      session = dropPiece({
        session,
        pieceId: geometry.id,
        position: geometry.solvedPosition,
        solvedPosition: geometry.solvedPosition,
        now: '2026-07-20T00:10:00.000Z',
        elapsedMs: 600_000,
        snapThreshold: threshold,
      });
    }

    expect(isSessionComplete(session)).toBe(true);
    expect(session.status).toBe('completed');
    expect(session.completedAt).toBe('2026-07-20T00:10:00.000Z');
    expect(countLockedPieces(session)).toBe(64);
  });
});
