import type { EdgeShape, PieceEdges, Point, Size } from './types';

import { KNOB_PROFILE, TAB_SIZE_RATIO } from './constants';

export type PathCommand =
  | { type: 'M'; x: number; y: number }
  | { type: 'L'; x: number; y: number }
  | {
      type: 'C';
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      x: number;
      y: number;
    }
  | { type: 'Z' };

export interface PieceLocalBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PieceLocalPath {
  commands: PathCommand[];
  /** Axis-aligned bounds in piece-local space, including tab overhang. */
  bounds: PieceLocalBounds;
  tabSize: number;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function pointOn(start: Point, end: Point, t: number): Point {
  return {
    x: lerp(start.x, end.x, t),
    y: lerp(start.y, end.y, t),
  };
}

function unitNormal(start: Point, end: Point): Point {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;
  // Clockwise outline: outward normal is (uy, -ux).
  return {
    x: dy / length,
    y: -(dx / length),
  };
}

function offset(point: Point, normal: Point, amount: number): Point {
  return {
    x: point.x + normal.x * amount,
    y: point.y + normal.y * amount,
  };
}

/**
 * Append one directed edge. `shape` 1 = outward tab, -1 = inward blank, 0 = flat.
 */
function appendEdge(
  commands: PathCommand[],
  start: Point,
  end: Point,
  shape: EdgeShape,
  tabSize: number,
): void {
  if (shape === 0) {
    commands.push({ type: 'L', x: end.x, y: end.y });
    return;
  }

  const normal = unitNormal(start, end);
  const depth = shape * tabSize;

  /** Map a normalized (t along edge, k outward) profile point into piece-local space. */
  const at = (t: number, k: number): Point => offset(pointOn(start, end, t), normal, k * depth);

  // Flat run up to the neck.
  const neck = at(KNOB_PROFILE.neckStart, 0);
  commands.push({ type: 'L', x: neck.x, y: neck.y });

  for (const segment of KNOB_PROFILE.segments) {
    const c1 = at(segment.c1.t, segment.c1.k);
    const c2 = at(segment.c2.t, segment.c2.k);
    const to = at(segment.to.t, segment.to.k);

    commands.push({
      type: 'C',
      x1: c1.x,
      y1: c1.y,
      x2: c2.x,
      y2: c2.y,
      x: to.x,
      y: to.y,
    });
  }

  // Flat run from the far side of the neck to the corner.
  commands.push({ type: 'L', x: end.x, y: end.y });
}

function collectBounds(commands: PathCommand[]): PieceLocalBounds {
  const xs: number[] = [];
  const ys: number[] = [];

  for (const command of commands) {
    if (command.type === 'M' || command.type === 'L') {
      xs.push(command.x);
      ys.push(command.y);
    } else if (command.type === 'C') {
      xs.push(command.x1, command.x2, command.x);
      ys.push(command.y1, command.y2, command.y);
    }
  }

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Closed clockwise piece silhouette in piece-local space.
 * The cell occupies [0, width] × [0, height]; tabs may extend outside that rectangle.
 */
export function buildPieceLocalPath(edges: PieceEdges, cellSize: Size): PieceLocalPath {
  if (cellSize.width <= 0 || cellSize.height <= 0) {
    throw new RangeError('Cell size must be positive.');
  }

  const tabSize = Math.min(cellSize.width, cellSize.height) * TAB_SIZE_RATIO;
  const topLeft = { x: 0, y: 0 };
  const topRight = { x: cellSize.width, y: 0 };
  const bottomRight = { x: cellSize.width, y: cellSize.height };
  const bottomLeft = { x: 0, y: cellSize.height };

  const commands: PathCommand[] = [{ type: 'M', x: topLeft.x, y: topLeft.y }];
  appendEdge(commands, topLeft, topRight, edges.top, tabSize);
  appendEdge(commands, topRight, bottomRight, edges.right, tabSize);
  appendEdge(commands, bottomRight, bottomLeft, edges.bottom, tabSize);
  appendEdge(commands, bottomLeft, topLeft, edges.left, tabSize);
  commands.push({ type: 'Z' });

  return {
    commands,
    tabSize,
    bounds: collectBounds(commands),
  };
}
