import { createPlayablePuzzle } from './playable';
import {
  countLockedPieces,
  dropPiece,
  isSessionComplete,
  snapThresholdForCellSize,
} from './session';
import type { PuzzleDefinition } from './types';

describe('createPlayablePuzzle', () => {
  it.each([8, 9, 10] as const)('bootstraps a full %s-grid session', (gridSize) => {
    const puzzle: PuzzleDefinition = {
      id: `grid-${gridSize}`,
      title: `Grid ${gridSize}`,
      image: { uri: 'asset://x', pixelSize: { width: 1000, height: 1000 } },
      gridSize,
      seed: `seed-${gridSize}`,
      revision: 1,
    };

    const { generated, session } = createPlayablePuzzle({
      puzzle,
      sessionId: `session-${gridSize}`,
      now: '2026-07-20T12:00:00.000Z',
      cellSize: 40,
      layoutMode: 'scatter',
    });

    expect(generated.pieces).toHaveLength(gridSize * gridSize);
    expect(session.pieces).toHaveLength(gridSize * gridSize);
    expect(session.status).toBe('not-started');
    expect(countLockedPieces(session)).toBe(0);

    for (const piece of session.pieces) {
      expect(piece.position.y).toBeGreaterThan(generated.boardSize.height);
    }
  });

  it('can complete a small playthrough through dropPiece', () => {
    const puzzle: PuzzleDefinition = {
      id: 'mini',
      title: 'Mini',
      image: { uri: 'asset://mini', pixelSize: { width: 800, height: 800 } },
      gridSize: 8,
      seed: 'mini',
      revision: 1,
    };

    let { generated, session } = createPlayablePuzzle({
      puzzle,
      sessionId: 's1',
      now: '2026-07-20T12:00:00.000Z',
      cellSize: 32,
    });

    const threshold = snapThresholdForCellSize(32);

    for (const geometry of generated.pieces) {
      session = dropPiece({
        session,
        pieceId: geometry.id,
        position: geometry.solvedPosition,
        solvedPosition: geometry.solvedPosition,
        now: '2026-07-20T12:05:00.000Z',
        elapsedMs: 300_000,
        snapThreshold: threshold,
      });
    }

    expect(isSessionComplete(session)).toBe(true);
    expect(session.status).toBe('completed');
  });
});
