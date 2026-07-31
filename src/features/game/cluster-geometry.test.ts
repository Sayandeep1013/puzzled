import { makePieceId } from '@/game-engine';

import { clusterCacheKey, clusterLockedPieces, type ClusterPiece } from './cluster-geometry';

/**
 * Clustering exists because depth was drawn per piece, which meant two joined pieces met
 * as a doubled light rim reading as a gap, and an assembled row looked like loose tiles.
 * These tests pin the grouping rule the fix depends on.
 */

const GRID = 4;

function at(row: number, column: number): ClusterPiece {
  return { pieceId: makePieceId(row, column), row, column };
}

/** Cluster containing `pieceId`, for assertions that do not care about ordering. */
function clusterWith(clusters: string[][], row: number, column: number): string[] {
  const id = makePieceId(row, column);
  const found = clusters.find((cluster) => cluster.includes(id));
  if (!found) {
    throw new Error(`No cluster contains ${id}`);
  }
  return found;
}

describe('clusterLockedPieces', () => {
  it('returns nothing when no piece is placed', () => {
    expect(clusterLockedPieces([], GRID)).toEqual([]);
  });

  it('treats a lone piece as a cluster of one, so it keeps depth all round', () => {
    expect(clusterLockedPieces([at(1, 1)], GRID)).toEqual([[makePieceId(1, 1)]]);
  });

  it('joins three in a row into one cluster', () => {
    // The user's own example: depth should survive on the outer left and right edges and
    // disappear between them.
    const clusters = clusterLockedPieces([at(0, 0), at(0, 1), at(0, 2)], GRID);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]).toEqual([makePieceId(0, 0), makePieceId(0, 1), makePieceId(0, 2)]);
  });

  it('keeps scattered pieces as separate clusters', () => {
    expect(clusterLockedPieces([at(0, 0), at(2, 2), at(3, 0)], GRID)).toHaveLength(3);
  });

  it('does not join pieces that only touch at a corner', () => {
    // Diagonal neighbours do not interlock, so they are not one assembly.
    expect(clusterLockedPieces([at(0, 0), at(1, 1)], GRID)).toHaveLength(2);
  });

  it('grows an existing cluster when a piece is added beside it', () => {
    const three = [at(0, 0), at(0, 1), at(0, 2)];
    const grown = clusterLockedPieces([...three, at(0, 3)], GRID);
    expect(grown).toHaveLength(1);
    expect(grown[0]).toHaveLength(4);
    // The piece added on the right is part of the same cluster, so the depth moves out
    // to it rather than a second cluster appearing.
    expect(grown[0]).toContain(makePieceId(0, 3));
  });

  it('merges two clusters when a bridging piece lands between them', () => {
    const split = clusterLockedPieces([at(0, 0), at(0, 2)], GRID);
    expect(split).toHaveLength(2);

    const bridged = clusterLockedPieces([at(0, 0), at(0, 2), at(0, 1)], GRID);
    expect(bridged).toHaveLength(1);
    expect(bridged[0]).toHaveLength(3);
  });

  it('joins vertically as well as horizontally', () => {
    const clusters = clusterLockedPieces([at(0, 1), at(1, 1), at(2, 1)], GRID);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]).toHaveLength(3);
  });

  it('groups an L shape as one cluster', () => {
    const clusters = clusterLockedPieces([at(0, 0), at(1, 0), at(1, 1)], GRID);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]).toHaveLength(3);
  });

  it('groups a completely solved board into a single cluster', () => {
    const all: ClusterPiece[] = [];
    for (let row = 0; row < GRID; row += 1) {
      for (let column = 0; column < GRID; column += 1) {
        all.push(at(row, column));
      }
    }
    const clusters = clusterLockedPieces(all, GRID);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]).toHaveLength(GRID * GRID);
  });

  it('is stable under input order, so cache keys do not churn', () => {
    const forward = clusterLockedPieces([at(0, 0), at(0, 1), at(0, 2)], GRID);
    const reversed = clusterLockedPieces([at(0, 2), at(0, 1), at(0, 0)], GRID);
    expect(reversed).toEqual(forward);
  });

  it('never places a piece in two clusters', () => {
    const pieces = [at(0, 0), at(0, 1), at(2, 2), at(3, 3)];
    const clusters = clusterLockedPieces(pieces, GRID);
    const flat = clusters.flat();
    expect(flat).toHaveLength(pieces.length);
    expect(new Set(flat).size).toBe(pieces.length);
  });

  it('puts a piece in the cluster of the neighbour it touches', () => {
    const clusters = clusterLockedPieces([at(0, 0), at(0, 1), at(2, 2)], GRID);
    expect(clusterWith(clusters, 0, 0)).toContain(makePieceId(0, 1));
    expect(clusterWith(clusters, 2, 2)).toEqual([makePieceId(2, 2)]);
  });
});

describe('clusterCacheKey', () => {
  it('ignores member ordering', () => {
    const a = clusterCacheKey([makePieceId(0, 1), makePieceId(0, 0)]);
    const b = clusterCacheKey([makePieceId(0, 0), makePieceId(0, 1)]);
    expect(a).toBe(b);
  });

  it('changes when membership changes, so a grown cluster re-bakes', () => {
    const before = clusterCacheKey([makePieceId(0, 0), makePieceId(0, 1)]);
    const after = clusterCacheKey([makePieceId(0, 0), makePieceId(0, 1), makePieceId(0, 2)]);
    expect(after).not.toBe(before);
  });
});
