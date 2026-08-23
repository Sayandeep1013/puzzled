import {
  BlendMode,
  FractalNoise,
  Group,
  Image,
  Path,
  PathOp,
  Shadow,
  Skia,
  TileMode,
  type SkImage,
  type SkPath,
} from '@shopify/react-native-skia';
import { useMemo } from 'react';

/**
 * The three piece-depth treatments being compared on device.
 *
 * See `docs/superpowers/specs/2026-07-31-cardboard-piece-depth-design.md`. The short
 * version: the previous attempts painted depth with *strokes*, which lay down a band
 * of constant colour, when a bevel is a gradient of surface normals. Nothing about a
 * stroke's width or alpha can produce one.
 *
 * Skia can, and it is already in the app. `MakeDistantLitDiffuse` interprets an alpha
 * channel as a **height profile** and derives real surface normals from it, so a
 * blurred silhouette becomes a genuinely lit bevel. It is the same primitive as SVG's
 * `feDiffuseLighting`, which is unsurprising — Skia is what renders Chrome's SVG
 * filters.
 *
 * Two constraints shape the code below:
 *
 * - Lighting filters are **imperative only** in react-native-skia 2.6.2; there is no
 *   declarative component, hence the hand-built `SkPaint`.
 * - Lighting output is **opaque RGBA**, so it must be masked back to the silhouette
 *   (SVG does this with `feComposite operator="in"`; here a `clip` does it) before
 *   it can sit over the artwork.
 */

export type DepthTreatment = 'current' | 'cardboard' | 'bevel';

/**
 * Tunables, in board units so they scale with the piece.
 *
 * These are the numbers the on-device comparison exists to settle — particularly
 * `lightZ` and `kd`, which together decide the brightness of the piece's *flat*
 * interior. Under `BlendMode.Overlay` a mid-grey leaves the interior untouched and
 * only the bevel ring reads, which is what we want; too bright and the whole piece
 * washes out, too dark and it muddies.
 */
export const DEPTH = {
  /** Width of the bevel, as a fraction of the piece's smaller bound. */
  bevelRatio: 0.09,
  /** Light direction. Negative x/y puts the light at the top-left. */
  lightX: -0.45,
  lightY: -0.55,
  lightZ: 0.7,
  /** Alpha-to-height scale handed to the lighting filter. */
  surfaceScale: 3.2,
  /** Diffuse coefficient. Tuned so a flat interior lands near mid-grey. */
  kd: 0.62,

  /**
   * The exposed fibre core at the die-cut edge, as a fraction of the smaller bound.
   *
   * A flat band of constant colour is *correct* here, unlike for the bevel: chipboard
   * is pressed fibre with the print laminated on top, so the cut genuinely exposes a
   * uniform band of pulp rather than a gradient. Being light is the point — this is
   * the cue the eye reads as cardboard, and the old "depth is shadow, never light"
   * rule is exactly what excluded it.
   */
  coreRatio: 0.022,
  coreColor: '#D9CDB4',
  /** Darker line right at the outer boundary, where the cut is crushed. */
  cutColor: 'rgba(120, 100, 72, 0.55)',
  cutRatio: 0.018,

  /** Paper grain. Procedural, so it costs no assets and never tiles visibly. */
  grainFrequency: 0.9,
  grainOctaves: 3,
  grainOpacity: 0.06,

  /** Drop shadow for pieces resting above a surface. */
  shadowDy: 4,
  shadowBlur: 7,
  shadowColor: 'rgba(46, 32, 16, 0.55)',
} as const;

/**
 * Paint carrying blur → diffuse-lighting, for use as a `Group` layer.
 *
 * The blur is what creates the bevel: inside the silhouette alpha is 1 and outside 0,
 * so blurring leaves a ramp at the boundary, and that ramp is the height profile the
 * lighting filter turns into normals. Blur sigma therefore *is* the bevel width.
 */
function useBevelPaint(bevelWidth: number, blend: BlendMode) {
  return useMemo(() => {
    const sigma = Math.max(bevelWidth / 2, 0.1);
    const blur = Skia.ImageFilter.MakeBlur(sigma, sigma, TileMode.Decal, null);
    const lit = Skia.ImageFilter.MakeDistantLitDiffuse(
      { x: DEPTH.lightX, y: DEPTH.lightY, z: DEPTH.lightZ },
      Skia.Color('white'),
      DEPTH.surfaceScale,
      DEPTH.kd,
      blur,
    );
    const paint = Skia.Paint();
    paint.setImageFilter(lit);
    paint.setBlendMode(blend);
    return paint;
  }, [bevelWidth, blend]);
}

interface PieceDepthProps {
  path: SkPath;
  image: SkImage;
  imageScale: number;
  /** Piece bounds in board units, for sizing the bevel and core to the piece. */
  smallerBound: number;
  /** Offsets the artwork so the piece samples its own region of the photo. */
  sourceX: number;
  sourceY: number;
  treatment: DepthTreatment;
  raised?: boolean;
}

/**
 * One piece, drawn with the requested treatment.
 *
 * Layer order is fixed for all treatments so the comparison is fair: shadow behind,
 * artwork, then the edge work on top.
 */
export function PieceDepth({
  path,
  image,
  imageScale,
  smallerBound,
  sourceX,
  sourceY,
  treatment,
  raised = true,
}: PieceDepthProps) {
  const bevelWidth = smallerBound * DEPTH.bevelRatio;
  const coreWidth = smallerBound * DEPTH.coreRatio;
  const cutWidth = smallerBound * DEPTH.cutRatio;
  const bevelPaint = useBevelPaint(bevelWidth, BlendMode.Overlay);

  /**
   * The bevel ring: the silhouette minus its own interior, so the lighting only ever
   * touches the edge.
   *
   * Necessary because lighting output is opaque, and a flat interior lights to a
   * *uniform* tone — clipping the lit result to the whole silhouette therefore washed
   * a flat grey over the entire piece and hid the artwork. Relying on `Overlay` to
   * make that grey neutral is too fragile: it only vanishes if the tone lands exactly
   * on mid-grey, which depends on `kd` and the light's z.
   *
   * A centred stroke of the outline intersected with the outline *is* the ring, which
   * avoids needing a path-erode primitive.
   */
  const bevelRing = useMemo(() => {
    const ring = path.copy().stroke({ width: bevelWidth * 2 });
    if (!ring) {
      return null;
    }
    return ring.op(path, PathOp.Intersect) ? ring : null;
  }, [path, bevelWidth]);

  return (
    <Group>
      {raised ? (
        <Path path={path} color={DEPTH.shadowColor} opacity={0.001}>
          <Shadow dx={0} dy={DEPTH.shadowDy} blur={DEPTH.shadowBlur} color={DEPTH.shadowColor} />
        </Path>
      ) : null}

      <Group clip={path}>
        <Image
          image={image}
          x={-sourceX * imageScale}
          y={-sourceY * imageScale}
          width={image.width() * imageScale}
          height={image.height() * imageScale}
        />
      </Group>

      {treatment === 'current' ? (
        /* What ships today: one blurred inward stroke. Included so the comparison
           shows what is actually being replaced rather than an idealised version. */
        <Group clip={path}>
          <Path path={path} style="stroke" strokeWidth={4} color="rgba(30, 22, 12, 0.38)" />
        </Group>
      ) : (
        <>
          {/* The lit bevel, clipped to the ring so the piece's interior keeps the
              artwork untouched and only its edge is shaded. */}
          {bevelRing ? (
            <Group clip={bevelRing} layer={bevelPaint}>
              <Path path={path} color="white" />
            </Group>
          ) : null}

          {/* Paper grain, over the whole piece. */}
          <Group clip={path} opacity={DEPTH.grainOpacity}>
            <Path path={path} color="white">
              <FractalNoise
                freqX={DEPTH.grainFrequency}
                freqY={DEPTH.grainFrequency}
                octaves={DEPTH.grainOctaves}
              />
            </Path>
          </Group>

          {/* The exposed fibre core — the cardboard cue, and only in `cardboard`. */}
          {treatment === 'cardboard' ? (
            <Group clip={path}>
              <Path
                path={path}
                style="stroke"
                strokeWidth={coreWidth * 2}
                color={DEPTH.coreColor}
              />
            </Group>
          ) : null}

          {/* The crushed outer cut, on both lit treatments. */}
          <Group clip={path}>
            <Path path={path} style="stroke" strokeWidth={cutWidth * 2} color={DEPTH.cutColor} />
          </Group>
        </>
      )}
    </Group>
  );
}
