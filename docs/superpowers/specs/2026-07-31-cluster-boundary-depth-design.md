# Cluster-boundary depth — design

Depth on the outline of each *connected group* of placed pieces, not on every piece.

---

## The problem

Two complaints, one cause.

**"The gap in between shouldn't exist."** The pieces are snapped correctly — a screenshot
of the top row shows them exactly aligned. The gap is *painted*. Every piece draws its
light fibre-core rim inward, so at each internal seam two rims meet and produce a pale
band of `2 × coreRatio`. A real puzzle has no cut edge there at all: two joined pieces
share one seam, not two cut edges.

**"Each piece having the depth effect makes it look bad."** Same cause, seen as a whole:
per-piece bevels make an assembled row read as loose tiles rather than one sheet of card.

So the unit of depth is wrong. It is currently the piece; it should be the connected
group.

## The rule

Depth is drawn on the boundary of a **cluster** — a maximal set of locked pieces joined
by orthogonal adjacency.

- Three pieces in a row: one cluster. Bevel on its outline, so the leftmost keeps its
  left edge, the rightmost keeps its right edge, and the middle piece's vertical edges
  disappear.
- A lone piece: a cluster of one, so it keeps depth on all sides. This falls out of the
  same code rather than needing a special case.
- Add a fourth piece to the right of those three: the cluster's shape changes and the
  depth moves to the new right edge.

Tray, loose and lifted pieces are untouched: they are separate objects above the board
and keep their own per-piece overlay and drop shadow.

## Decisions taken

- **Internal seams: a faint hairline.** Real puzzles show their seams. Invisible seams
  would make the assembled area stop reading as pieces at all. The hairline is a single
  darker line, nothing like the doubled light rim it replaces.
- **A cluster casts a drop shadow.** It reads as a sheet of card resting on the board,
  which is what makes the depth physical. Locked pieces currently cast nothing, so the
  board looks flat exactly where the player has made progress.

## Architecture

```
locked pieces ──► clusterLockedPieces()  ──► clusters: string[][]
                                              │
                                              ▼
                        unionClusterPath()  ──► one SkPath per cluster
                                              │
                                              ▼
                        bakeClusterOverlay() ──► SkImage per cluster (cached)
```

Draw order per cluster:

1. Cluster drop shadow, from the union path.
2. Each member piece's artwork, clipped to its own silhouette — this cannot be merged,
   because every piece samples a different region of the photo.
3. Faint hairline seams: each member's outline, stroked thinly, clipped to the union.
4. The cluster's baked depth overlay: bevel and fibre core on the union outline only.

### New module: `cluster-geometry.ts`

Pure, Skia-free where possible, so it can be tested directly (`puzzle-board.tsx` imports
Skia at module scope, which jest cannot load — the same constraint that put
`tray-geometry.ts` in its own file).

- `clusterLockedPieces(locked, gridSize)` → `string[][]`. Flood fill over orthogonal
  neighbours using `makePieceId(row, column)`. Deterministic order so cache keys are
  stable.
- `clusterCacheKey(memberIds)` → sorted join, so a cluster's identity is its membership.

Union path building stays in `puzzle-board.tsx` alongside the other Skia work.

### Caching

Cluster shapes change only when a piece is placed, never per frame. Bake on change,
keyed by `clusterCacheKey`, and keep a `Map` for the current session. A frame then draws
one overlay image per cluster — *fewer* draws than the current one-per-piece.

The existing per-shape bake (`piece-overlay.ts`) stays for tray, loose and lifted pieces
and needs no change.

## Risks

- **`PathOp.Union` cost.** A near-complete 10×10 board unions ~100 paths on each
  placement. Incremental union is O(n) but must be measured, not assumed. If it is too
  slow, the fallback is to union incrementally: keep each cluster's path and union only
  the newly-placed piece into it, which is O(1) per placement.
- **Union of touching-but-not-overlapping paths.** Adjacent silhouettes share an edge
  exactly; a union of exactly-abutting paths can leave hairline artefacts from floating
  point. Mitigation: the hairline seam pass draws over those positions anyway, and the
  overlay bevel is derived from the union's *outer* boundary where this does not arise.
- **Corner rounding.** The four board-corner pieces already trim their outward corner to
  the frame radius; the union inherits that automatically.

## Testing

`cluster-geometry.test.ts`, on the pure functions:

- A single locked piece is one cluster of one.
- Three in a row are one cluster; three scattered are three clusters.
- Diagonal adjacency does *not* join a cluster (orthogonal only).
- Adding a piece adjacent to a cluster grows that cluster rather than making a new one.
- Two clusters joined by a bridging piece merge into one.
- Cache keys are stable under member ordering.

Union paths and the bake are verified on device, since they are Skia-side.
