import { buildPieceLocalPath, cellSizeForGrid, TAB_SIZE_RATIO, type GridSize } from '@/game-engine';

import { maxPieceExtent, TRAY_SLOT, trayThumbScale } from './tray-geometry';

/**
 * Pieces overflowed their tray slots, and the cause was a prediction standing in
 * for a measurement: the tray scaled pieces by `cellSize * (1 + 2 * TAB_SIZE_RATIO)`
 * — a cell plus one tab each side — while real bounds are taken from the curves'
 * control points and run 12.9% larger.
 *
 * These tests assert the fit itself rather than the constant, so they keep holding
 * if the piece path changes shape.
 */

const GRID_SIZES: GridSize[] = [3, 4, 5, 6, 7, 8, 9, 10];
const EDGE_VALUES = [-1, 0, 1] as const;

/** Every distinct piece shape the generator can produce, for one cell size. */
function allPieceShapes(cellSize: number) {
  const cell = { width: cellSize, height: cellSize };
  const paths = [];
  for (const top of EDGE_VALUES) {
    for (const right of EDGE_VALUES) {
      for (const bottom of EDGE_VALUES) {
        for (const left of EDGE_VALUES) {
          paths.push(buildPieceLocalPath({ top, right, bottom, left }, cell));
        }
      }
    }
  }
  return paths;
}

describe('tray piece fit', () => {
  it.each(GRID_SIZES)('keeps every %ix piece inside its slot', (gridSize) => {
    const cellSize = cellSizeForGrid(gridSize);
    const shapes = allPieceShapes(cellSize);
    const scale = trayThumbScale(TRAY_SLOT, maxPieceExtent(shapes));

    for (const { bounds } of shapes) {
      expect(bounds.width * scale).toBeLessThanOrEqual(TRAY_SLOT);
      expect(bounds.height * scale).toBeLessThanOrEqual(TRAY_SLOT);
    }
  });

  it('leaves a real margin rather than filling the slot edge to edge', () => {
    const shapes = allPieceShapes(cellSizeForGrid(4));
    const extent = maxPieceExtent(shapes);
    // The largest piece should land near the intended fill fraction, so slots read
    // as separate. Before the fix the effective figure was 0.97.
    expect(extent * trayThumbScale(TRAY_SLOT, extent)).toBeLessThanOrEqual(TRAY_SLOT * 0.9);
  });

  it('measures a larger extent than the cell-plus-tabs prediction', () => {
    // Pins the reason the prediction was abandoned. If the path ever shrinks inside
    // its prediction this fails, and the comment in `maxPieceExtent` needs revising.
    const cellSize = cellSizeForGrid(4);
    const predicted = cellSize * (1 + 2 * TAB_SIZE_RATIO);
    expect(maxPieceExtent(allPieceShapes(cellSize))).toBeGreaterThan(predicted);
  });
});
