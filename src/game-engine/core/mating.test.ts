import { generatePuzzlePieces } from './generate';
import { TAB_SIZE_RATIO } from './constants';
import type { PuzzleDefinition } from './types';

/**
 * Shared-edge peaks for neighboring pieces must land on the same board point
 * so tabs and blanks visually mate when both pieces are solved.
 */
describe('adjacent edge mating', () => {
  const puzzle: PuzzleDefinition = {
    id: 'mate-check',
    title: 'Mate Check',
    image: { uri: 'asset://mate', pixelSize: { width: 900, height: 900 } },
    gridSize: 8,
    seed: 'mate-seed',
    revision: 1,
  };

  it('aligns horizontal tab/blank peaks in board space', () => {
    const cellSize = 100;
    const generated = generatePuzzlePieces({ puzzle, cellSize });
    const left = generated.pieces.find((piece) => piece.id === '2:3');
    const right = generated.pieces.find((piece) => piece.id === '2:4');

    expect(left).toBeDefined();
    expect(right).toBeDefined();
    expect(left!.edges.right).toBe(-right!.edges.left);
    expect(left!.edges.right).not.toBe(0);

    const tabSize = cellSize * TAB_SIZE_RATIO;
    const midY = cellSize / 2;
    const leftPeakBoardX = left!.solvedPosition.x + cellSize + left!.edges.right * tabSize;
    const rightPeakBoardX = right!.solvedPosition.x + -right!.edges.left * tabSize;

    expect(leftPeakBoardX).toBeCloseTo(rightPeakBoardX, 8);
    expect(left!.solvedPosition.y + midY).toBeCloseTo(right!.solvedPosition.y + midY, 8);
  });

  it('aligns vertical tab/blank peaks in board space', () => {
    const cellSize = 100;
    const generated = generatePuzzlePieces({ puzzle, cellSize });
    const top = generated.pieces.find((piece) => piece.id === '3:2');
    const bottom = generated.pieces.find((piece) => piece.id === '4:2');

    expect(top).toBeDefined();
    expect(bottom).toBeDefined();
    expect(top!.edges.bottom).toBe(-bottom!.edges.top);
    expect(top!.edges.bottom).not.toBe(0);

    const tabSize = cellSize * TAB_SIZE_RATIO;
    const midX = cellSize / 2;
    const topPeakBoardY = top!.solvedPosition.y + cellSize + top!.edges.bottom * tabSize;
    const bottomPeakBoardY = bottom!.solvedPosition.y + -bottom!.edges.top * tabSize;

    expect(topPeakBoardY).toBeCloseTo(bottomPeakBoardY, 8);
    expect(top!.solvedPosition.x + midX).toBeCloseTo(bottom!.solvedPosition.x + midX, 8);
  });
});
