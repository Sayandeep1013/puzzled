import type { PieceGeometry, Point, Size } from './types';

import { createSeededRng } from './rng';

export type LayoutMode = 'tray' | 'scatter';

export interface LayoutOptions {
  pieces: readonly PieceGeometry[];
  boardSize: Size;
  mode: LayoutMode;
  seed: string;
  /** Gap between tray slots. Defaults to 8. */
  gap?: number;
  /** Extra vertical space below the board reserved for the tray. Defaults to 1.35 × board height. */
  trayHeightFactor?: number;
}

function trayPositions(
  pieces: readonly PieceGeometry[],
  boardSize: Size,
  gap: number,
  trayHeightFactor: number,
): Record<string, Point> {
  const columns = Math.ceil(Math.sqrt(pieces.length));
  const cellWidth = boardSize.width / columns;
  const trayTop = boardSize.height + gap;
  const trayHeight = boardSize.height * trayHeightFactor;
  const rows = Math.ceil(pieces.length / columns);
  const cellHeight = trayHeight / rows;
  const positions: Record<string, Point> = {};

  pieces.forEach((piece, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    positions[piece.id] = {
      x: column * cellWidth + gap,
      y: trayTop + row * cellHeight + gap,
    };
  });

  return positions;
}

function scatterPositions(
  pieces: readonly PieceGeometry[],
  boardSize: Size,
  seed: string,
  gap: number,
  trayHeightFactor: number,
): Record<string, Point> {
  const random = createSeededRng(`${seed}:scatter`);
  const trayTop = boardSize.height + gap;
  const trayHeight = boardSize.height * trayHeightFactor;
  const positions: Record<string, Point> = {};

  for (const piece of pieces) {
    positions[piece.id] = {
      x: random() * Math.max(boardSize.width - gap * 2, gap),
      y: trayTop + random() * Math.max(trayHeight - gap * 2, gap),
    };
  }

  return positions;
}

/**
 * Deterministic initial piece placement outside the solved board area.
 */
export function createInitialPositions({
  pieces,
  boardSize,
  mode,
  seed,
  gap = 8,
  trayHeightFactor = 1.35,
}: LayoutOptions): Record<string, Point> {
  if (boardSize.width <= 0 || boardSize.height <= 0) {
    throw new RangeError('Board size must be positive.');
  }

  if (mode === 'tray') {
    return trayPositions(pieces, boardSize, gap, trayHeightFactor);
  }

  return scatterPositions(pieces, boardSize, seed, gap, trayHeightFactor);
}
