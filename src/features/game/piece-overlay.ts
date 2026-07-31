import {
  ClipOp,
  PaintStyle,
  Skia,
  TileMode,
  type SkImage,
  type SkPath,
  type SkRect,
} from '@shopify/react-native-skia';

import { type PieceEdges } from '@/game-engine';

/**
 * Bakes the cardboard depth of a piece into a transparent overlay image.
 *
 * The overlay holds only *depth* — bevel, cut edge, grain — and never any artwork, so
 * one overlay serves any photo. That is what makes gallery imports work: a picture
 * imported seconds ago gets the same treatment as bundled art, with no per-puzzle
 * assets to author.
 *
 * ## How the bevel is real
 *
 * `MakeDistantLitDiffuse` reads an alpha channel as a **height profile** and derives
 * surface normals from it (its own docs say so). Blurring the silhouette leaves a ramp
 * at the boundary, and that ramp is the bevel: the filter lights it as an actual
 * rounded-over surface. This is SVG's `feGaussianBlur` → `feDiffuseLighting`, and Skia
 * renders Chrome's SVG filters, so it is the same well-trodden primitive.
 *
 * Three earlier attempts painted depth with *strokes* instead. A stroke lays down a
 * band of constant colour; a bevel is a gradient of normals. No width or alpha
 * converts one into the other, which is why every "make it stronger" round produced a
 * thicker outline and never depth.
 *
 * ## How the flat interior stays transparent
 *
 * Lighting output is **opaque**, so it cannot simply be drawn over the artwork. It is
 * converted to signed light/shade with two colour matrices: one keeps only the pixels
 * brighter than neutral (as white), the other only those darker (as black), each with
 * alpha proportional to the distance from neutral.
 *
 * `NEUTRAL_KD` is what makes this work. A flat surface has normal (0,0,1), so it lights
 * to `kd * L̂.z`; choosing `kd = 0.5 / L̂.z` puts a flat surface exactly on neutral,
 * where **both matrices yield alpha 0**. The piece's interior therefore drops out on
 * its own and only the sloped bevel band survives — no masking ring required, and no
 * dependence on a blend mode being perfectly neutral.
 */

/** Relative luminance weights (Rec. 709), for measuring distance from neutral. */
const LUMA = [0.2126, 0.7152, 0.0722] as const;

/** Light direction. Negative x/y places the light at the top-left. */
const LIGHT = { x: -0.45, y: -0.55, z: 0.7 } as const;

const LIGHT_LENGTH = Math.hypot(LIGHT.x, LIGHT.y, LIGHT.z);

/**
 * Diffuse coefficient that lights a *flat* surface to exactly neutral grey, so the
 * piece's interior converts to alpha 0 and vanishes from the overlay.
 */
const NEUTRAL_KD = 0.5 / (LIGHT.z / LIGHT_LENGTH);

export const OVERLAY = {
  /** Alpha-to-height scale for the lighting filter. Higher reads as thicker board. */
  surfaceScale: 3.4,
  /** Bevel width as a fraction of the piece's smaller bound. */
  bevelRatio: 0.085,
  /** Strength of the lit and shaded halves of the bevel. */
  lightStrength: 0.85,
  shadeStrength: 0.75,

  /**
   * The exposed fibre core at the die cut, as a fraction of the smaller bound.
   *
   * Deliberately minimal. Chipboard is pressed fibre with the print laminated on top,
   * so the cut exposes a thin band of pulp — and being *light* is the whole point,
   * since that is the cue the eye reads as cardboard rather than as a sticker.
   */
  coreRatio: 0.02,
  coreColor: 'rgba(226, 216, 194, 0.98)',
  /** A darker line at the very boundary, where the die crushes the edge. */
  cutRatio: 0.01,
  cutColor: 'rgba(104, 86, 60, 0.6)',

  /** Procedural paper grain: no asset, and it never tiles visibly. */
  grainFreq: 0.42,
  grainOctaves: 3,
  grainOpacity: 0.05,

  /**
   * Supersample factor for the bake, in overlay pixels per board unit.
   *
   * The overlay is drawn at whatever size the piece happens to be — full size on the
   * board, ~0.7x in the tray, 1.08x while lifted — so it is baked above the largest of
   * those and downscaled, which keeps the bevel crisp instead of visibly soft.
   */
  scale: 3,
} as const;

/**
 * How hard the distance from neutral is amplified into alpha.
 *
 * A bevel this narrow only tilts its normals a little, so the lit result sits *close*
 * to neutral — the first version used a gain of 2, which mapped that small deviation
 * to almost zero alpha and produced an overlay that was technically correct and
 * visually blank. The gain is what converts a physically faint slope into a visible
 * edge; `alpha = gain * (luminance - 0.5)`, clamped by Skia.
 */
const BEVEL_GAIN = 4;

/** Colour matrix keeping only pixels brighter than neutral, as white with alpha. */
const LIGHT_MATRIX = [
  0,
  0,
  0,
  0,
  1,
  0,
  0,
  0,
  0,
  1,
  0,
  0,
  0,
  0,
  1,
  BEVEL_GAIN * LUMA[0],
  BEVEL_GAIN * LUMA[1],
  BEVEL_GAIN * LUMA[2],
  0,
  -BEVEL_GAIN / 2,
];

/** Colour matrix keeping only pixels darker than neutral, as black with alpha. */
const SHADE_MATRIX = [
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  -BEVEL_GAIN * LUMA[0],
  -BEVEL_GAIN * LUMA[1],
  -BEVEL_GAIN * LUMA[2],
  0,
  BEVEL_GAIN / 2,
];

/** A piece's shape is fully determined by its four edge codes and its cell size. */
export function overlayCacheKey(edges: PieceEdges, cellSize: number): string {
  return `${edges.top},${edges.right},${edges.bottom},${edges.left}@${cellSize}`;
}

function bevelPaint(bevelWidth: number, matrix: number[], strength: number) {
  const sigma = Math.max(bevelWidth / 2, 0.1);
  const lit = Skia.ImageFilter.MakeDistantLitDiffuse(
    LIGHT,
    Skia.Color('white'),
    OVERLAY.surfaceScale,
    NEUTRAL_KD,
    Skia.ImageFilter.MakeBlur(sigma, sigma, TileMode.Decal, null),
  );
  const paint = Skia.Paint();
  paint.setImageFilter(Skia.ImageFilter.MakeColorFilter(Skia.ColorFilter.MakeMatrix(matrix), lit));
  paint.setAlphaf(strength);
  return paint;
}

export interface BakedOverlay {
  image: SkImage;
  /** Board-unit rect the image should be drawn into. */
  rect: SkRect;
}

/**
 * Render one piece's depth overlay. Returns null if Skia cannot allocate a surface,
 * in which case the caller simply draws the piece without depth.
 */
export function bakePieceOverlay(path: SkPath, bounds: SkRect): BakedOverlay | null {
  const smaller = Math.min(bounds.width, bounds.height);
  if (smaller <= 0) {
    return null;
  }

  const bevelWidth = smaller * OVERLAY.bevelRatio;
  const coreWidth = smaller * OVERLAY.coreRatio;
  const cutWidth = smaller * OVERLAY.cutRatio;

  const pixelW = Math.ceil(bounds.width * OVERLAY.scale);
  const pixelH = Math.ceil(bounds.height * OVERLAY.scale);
  const surface = Skia.Surface.MakeOffscreen(pixelW, pixelH);
  if (!surface) {
    return null;
  }

  const canvas = surface.getCanvas();
  canvas.scale(OVERLAY.scale, OVERLAY.scale);
  canvas.translate(-bounds.x, -bounds.y);

  const white = Skia.Paint();
  white.setColor(Skia.Color('white'));

  /*
   * Clipped, not masked.
   *
   * The blur spreads the lighting well past the silhouette, and the first attempt
   * trimmed it by drawing the path with `BlendMode.DstIn`. That cannot work: a blend
   * mode only affects the pixels its *source* covers, so drawing the path left
   * everything outside the path untouched and the spill survived — visible as dark
   * smears sitting on the board beside the piece. A clip bounds the whole layer
   * instead, including the filter's output.
   */
  canvas.save();
  canvas.clipPath(path, ClipOp.Intersect, true);

  // Shade first, then light, so a lit highlight wins where the two bands meet.
  for (const [matrix, strength] of [
    [SHADE_MATRIX, OVERLAY.shadeStrength],
    [LIGHT_MATRIX, OVERLAY.lightStrength],
  ] as const) {
    canvas.saveLayer(bevelPaint(bevelWidth, matrix, strength));
    canvas.drawPath(path, white);
    canvas.restore();
  }

  // Everything below is an ordinary flat band, which is *correct* for a cut edge: the
  // pulp really is a uniform colour, unlike the bevel's gradient.

  const grain = Skia.Paint();
  grain.setShader(
    Skia.Shader.MakeFractalNoise(
      OVERLAY.grainFreq,
      OVERLAY.grainFreq,
      OVERLAY.grainOctaves,
      0,
      0,
      0,
    ),
  );
  grain.setAlphaf(OVERLAY.grainOpacity);
  canvas.drawPath(path, grain);

  // Doubled widths: the clip discards the outer half of a centred stroke.
  const core = Skia.Paint();
  core.setColor(Skia.Color(OVERLAY.coreColor));
  core.setStyle(PaintStyle.Stroke);
  core.setStrokeWidth(coreWidth * 2);
  canvas.drawPath(path, core);

  const cut = Skia.Paint();
  cut.setColor(Skia.Color(OVERLAY.cutColor));
  cut.setStyle(PaintStyle.Stroke);
  cut.setStrokeWidth(cutWidth * 2);
  canvas.drawPath(path, cut);

  canvas.restore();

  // Offscreen surfaces are not flushed implicitly; snapshotting without this can
  // capture a partially-drawn surface.
  surface.flush();

  /*
   * `makeNonTextureImage` is not optional here.
   *
   * An offscreen snapshot is backed by a GPU texture belonging to *that* surface's
   * context. Drawing it into the board's own canvas silently produced nothing at all —
   * not a faint overlay, an empty one, which is how this was spotted: even a fully
   * opaque 2-unit stroke failed to appear, so the problem could not have been the
   * bevel's strength. Copying to a CPU-backed image makes it valid in any context.
   */
  const snapshot = surface.makeImageSnapshot();
  const image = snapshot.makeNonTextureImage() ?? snapshot;
  return { image, rect: Skia.XYWHRect(bounds.x, bounds.y, bounds.width, bounds.height) };
}
