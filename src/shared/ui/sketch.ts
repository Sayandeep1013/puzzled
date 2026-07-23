import { Skia, type SkPath } from '@shopify/react-native-skia';

/** Deterministic PRNG (mulberry32) so a given seed always draws the same wobble. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Turn any string (e.g. a label) into a stable 32-bit seed. */
export function seedFromString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

interface Point {
  x: number;
  y: number;
}

/**
 * Sample the outline of a rounded rectangle as an ordered list of points,
 * walking the four straight edges and four quarter-circle corners.
 */
function roundedRectPoints(
  width: number,
  height: number,
  radius: number,
  step: number,
): Point[] {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  const pts: Point[] = [];

  const edge = (from: Point, to: Point) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy);
    const count = Math.max(1, Math.round(len / step));
    for (let i = 0; i < count; i += 1) {
      const t = i / count;
      pts.push({ x: from.x + dx * t, y: from.y + dy * t });
    }
  };

  const arc = (cx: number, cy: number, startAngle: number) => {
    const count = Math.max(2, Math.round((r * (Math.PI / 2)) / step));
    for (let i = 0; i < count; i += 1) {
      const a = startAngle + (Math.PI / 2) * (i / count);
      pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
  };

  // Top edge → top-right corner → right edge → ... clockwise from top-left.
  edge({ x: r, y: 0 }, { x: width - r, y: 0 });
  arc(width - r, r, -Math.PI / 2);
  edge({ x: width, y: r }, { x: width, y: height - r });
  arc(width - r, height - r, 0);
  edge({ x: width - r, y: height }, { x: r, y: height });
  arc(r, height - r, Math.PI / 2);
  edge({ x: 0, y: height - r }, { x: 0, y: r });
  arc(r, r, Math.PI);

  return pts;
}

/**
 * Build a closed, hand-drawn rounded-rect path: the ideal outline sampled and
 * nudged by a seeded jitter, then smoothed with quadratics so the border reads
 * as an organic marker stroke rather than a mechanical rectangle.
 */
export function roughRoundedRectPath(
  width: number,
  height: number,
  radius: number,
  seed: number,
  jitter = 1.6,
): SkPath {
  const rng = seededRandom(seed);
  const base = roundedRectPoints(width, height, radius, 14);
  const pts = base.map((p) => ({
    x: p.x + (rng() - 0.5) * 2 * jitter,
    y: p.y + (rng() - 0.5) * 2 * jitter,
  }));

  const path = Skia.Path.Make();
  if (pts.length < 3) {
    return path;
  }

  // Start at the midpoint of the last→first segment, then curve through each
  // vertex using the following midpoint as the on-curve anchor.
  const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const first = mid(pts[pts.length - 1], pts[0]);
  path.moveTo(first.x, first.y);
  for (let i = 0; i < pts.length; i += 1) {
    const curr = pts[i];
    const next = pts[(i + 1) % pts.length];
    const anchor = mid(curr, next);
    path.quadTo(curr.x, curr.y, anchor.x, anchor.y);
  }
  path.close();
  return path;
}
