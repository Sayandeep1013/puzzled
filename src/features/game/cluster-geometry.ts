import { makePieceId, type GridSize } from '@/game-engine';

/**
 * Groups locked pieces into connected clusters, so depth can be drawn on the outline of
 * an assembly rather than on every piece in it.
 *
 * Per-piece depth produced two problems with one cause: each piece drew its own light
 * fibre-core rim inward, so two joined pieces met as a *doubled* pale band that read as
 * a gap — where a real puzzle has one shared seam and no cut edge at all — and per-piece
 * bevels made an assembled row look like loose tiles instead of one sheet of card.
 *
 * The unit of depth is therefore the cluster:
 *
 * - Three pieces in a row are one cluster. The bevel follows its outline, so the
 *   leftmost keeps its left edge, the rightmost keeps its right edge, and the middle
 *   piece's vertical edges disappear.
 * - A lone piece is a cluster of one and keeps depth on every side, which falls out of
 *   the same code rather than needing a special case.
 * - Placing a fourth piece beside those three changes the cluster's shape, so the depth
 *   moves outward to the new edge.
 *
 * Kept free of Skia so jest can load it — `puzzle-board.tsx` imports Skia at module
 * scope, which jest cannot, the same constraint that put `tray-geometry.ts` in its own
 * file. Union-path building lives there, beside the other Skia work.
 */

/** A piece's position on the grid. Only what clustering needs. */
export interface ClusterPiece {
  pieceId: string;
  row: number;
  column: number;
}

/**
 * Maximal sets of pieces joined edge to edge.
 *
 * Orthogonal adjacency only: two pieces touching at a corner do not interlock, so they
 * are not one assembly and each keeps its own boundary.
 *
 * Clusters and their members come back in a deterministic order — ascending by
 * `row * gridSize + column` — so a cluster's cache key does not change just because the
 * caller's input order did.
 */
export function clusterLockedPieces(
  pieces: readonly ClusterPiece[],
  gridSize: GridSize,
): string[][] {
  const byCell = new Map<string, ClusterPiece>();
  for (const piece of pieces) {
    byCell.set(cellKey(piece.row, piece.column), piece);
  }

  // Sorted so both the cluster order and the member order are stable.
  const ordered = [...pieces].sort(
    (a, b) => a.row * gridSize + a.column - (b.row * gridSize + b.column),
  );

  const seen = new Set<string>();
  const clusters: string[][] = [];

  for (const start of ordered) {
    const startKey = cellKey(start.row, start.column);
    if (seen.has(startKey)) {
      continue;
    }

    // Iterative flood fill: a full 10x10 board is one cluster of 100, and recursion
    // that deep for a purely mechanical walk buys nothing.
    const members: ClusterPiece[] = [];
    const queue: ClusterPiece[] = [start];
    seen.add(startKey);

    while (queue.length > 0) {
      const current = queue.pop()!;
      members.push(current);

      for (const [row, column] of orthogonalNeighbours(current)) {
        if (row < 0 || column < 0 || row >= gridSize || column >= gridSize) {
          continue;
        }
        const key = cellKey(row, column);
        if (seen.has(key)) {
          continue;
        }
        const neighbour = byCell.get(key);
        if (neighbour) {
          seen.add(key);
          queue.push(neighbour);
        }
      }
    }

    members.sort((a, b) => a.row * gridSize + a.column - (b.row * gridSize + b.column));
    clusters.push(members.map((member) => member.pieceId));
  }

  return clusters;
}

function orthogonalNeighbours({ row, column }: ClusterPiece): [number, number][] {
  return [
    [row - 1, column],
    [row + 1, column],
    [row, column - 1],
    [row, column + 1],
  ];
}

function cellKey(row: number, column: number): string {
  return makePieceId(row, column);
}

/**
 * A cluster's identity is its membership, so the baked overlay for a shape can be reused
 * until that shape changes. Sorted, so ordering never invalidates a cache entry.
 */
export function clusterCacheKey(memberIds: readonly string[]): string {
  return [...memberIds].sort().join('|');
}
