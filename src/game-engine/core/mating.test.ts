import { generatePuzzlePieces } from './generate';
import type { PathCommand } from './path';
import type { PieceEdges, PuzzleDefinition } from './types';

/**
 * Neighbouring pieces must trace the *same curve* along a shared edge, otherwise
 * a tab and its blank overlap or leave a gap when both are solved.
 *
 * A shared edge is walked in opposite directions by the two pieces (both outlines
 * are clockwise), so the neighbour's point list is the reverse of this piece's.
 * Reversing a flat [P0, C1, C2, P3] list also reverses each cubic correctly.
 */

const EDGE_ORDER = ['top', 'right', 'bottom', 'left'] as const;
type EdgeName = (typeof EDGE_ORDER)[number];

/** Commands emitted per edge: 1 for a flat line, 5 for a knob (L + 3×C + L). */
function commandCount(shape: number): number {
  return shape === 0 ? 1 : 5;
}

function edgeCommands(commands: PathCommand[], edges: PieceEdges, edge: EdgeName): PathCommand[] {
  let index = 1; // Skip the leading move command.

  for (const name of EDGE_ORDER) {
    const count = commandCount(edges[name]);
    if (name === edge) {
      return commands.slice(index, index + count);
    }
    index += count;
  }

  throw new Error(`Unknown edge: ${edge}`);
}

function edgeStart(edge: EdgeName, cellSize: number): [number, number] {
  switch (edge) {
    case 'top':
      return [0, 0];
    case 'right':
      return [cellSize, 0];
    case 'bottom':
      return [cellSize, cellSize];
    case 'left':
      return [0, cellSize];
  }
}

/** Flat list of every point on an edge, in traversal order, in board space. */
function edgePoints(
  commands: PathCommand[],
  edges: PieceEdges,
  edge: EdgeName,
  cellSize: number,
  origin: { x: number; y: number },
): [number, number][] {
  const [startX, startY] = edgeStart(edge, cellSize);
  const points: [number, number][] = [[origin.x + startX, origin.y + startY]];

  for (const command of edgeCommands(commands, edges, edge)) {
    if (command.type === 'L') {
      points.push([origin.x + command.x, origin.y + command.y]);
    } else if (command.type === 'C') {
      points.push([origin.x + command.x1, origin.y + command.y1]);
      points.push([origin.x + command.x2, origin.y + command.y2]);
      points.push([origin.x + command.x, origin.y + command.y]);
    }
  }

  return points;
}

describe('adjacent edge mating', () => {
  const puzzle: PuzzleDefinition = {
    id: 'mate-check',
    title: 'Mate Check',
    image: { uri: 'asset://mate', pixelSize: { width: 900, height: 900 } },
    gridSize: 8,
    seed: 'mate-seed',
    revision: 1,
  };

  const cellSize = 100;
  const generated = generatePuzzlePieces({ puzzle, cellSize });

  function pieceAt(row: number, column: number) {
    const geometry = generated.pieces.find((p) => p.row === row && p.column === column);
    if (!geometry) {
      throw new Error(`Missing piece ${row}:${column}`);
    }
    return { geometry, path: generated.paths[geometry.id] };
  }

  function expectSharedEdge(
    a: { row: number; column: number; edge: EdgeName },
    b: { row: number; column: number; edge: EdgeName },
  ) {
    const left = pieceAt(a.row, a.column);
    const right = pieceAt(b.row, b.column);

    expect(left.geometry.edges[a.edge]).toBe(-right.geometry.edges[b.edge]);
    expect(left.geometry.edges[a.edge]).not.toBe(0);

    const forward = edgePoints(
      left.path.commands,
      left.geometry.edges,
      a.edge,
      cellSize,
      left.geometry.solvedPosition,
    );
    const backward = edgePoints(
      right.path.commands,
      right.geometry.edges,
      b.edge,
      cellSize,
      right.geometry.solvedPosition,
    ).reverse();

    expect(forward).toHaveLength(backward.length);
    forward.forEach(([x, y], index) => {
      expect(x).toBeCloseTo(backward[index][0], 8);
      expect(y).toBeCloseTo(backward[index][1], 8);
    });
  }

  it('traces an identical curve along a shared vertical edge', () => {
    expectSharedEdge({ row: 2, column: 3, edge: 'right' }, { row: 2, column: 4, edge: 'left' });
  });

  it('traces an identical curve along a shared horizontal edge', () => {
    expectSharedEdge({ row: 3, column: 2, edge: 'bottom' }, { row: 4, column: 2, edge: 'top' });
  });

  it('mates every interior edge on the board', () => {
    for (let row = 0; row < puzzle.gridSize; row += 1) {
      for (let column = 0; column < puzzle.gridSize; column += 1) {
        if (column < puzzle.gridSize - 1) {
          expectSharedEdge(
            { row, column, edge: 'right' },
            { row, column: column + 1, edge: 'left' },
          );
        }
        if (row < puzzle.gridSize - 1) {
          expectSharedEdge({ row, column, edge: 'bottom' }, { row: row + 1, column, edge: 'top' });
        }
      }
    }
  });

  it('keeps the knob bulb wider than its neck so pieces interlock', () => {
    const { geometry, path } = pieceAt(2, 3);
    const shape = geometry.edges.right;
    const points = edgePoints(path.commands, geometry.edges, 'right', cellSize, {
      x: 0,
      y: 0,
    });

    // Along a right edge, y spans the edge and x measures outward from x = cellSize.
    const neckYs = [points[1][1], points[points.length - 2][1]];
    const neckSpan = Math.abs(neckYs[1] - neckYs[0]);

    // Widest extent of the bulb: points at (or beyond) full protrusion.
    const outward = points.map(([x]) => (x - cellSize) * shape);
    const peak = Math.max(...outward);
    const bulbYs = points.filter((_, i) => outward[i] > peak * 0.6).map(([, y]) => y);
    const bulbSpan = Math.max(...bulbYs) - Math.min(...bulbYs);

    expect(bulbSpan).toBeGreaterThan(neckSpan);
  });
});
