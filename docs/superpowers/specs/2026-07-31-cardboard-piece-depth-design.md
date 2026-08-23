# Cardboard piece depth — design

Can procedurally generated jigsaw pieces look like real cardboard, with no
per-puzzle assets, for arbitrary gallery-imported photos?

**Yes.** This records why, the technique, and the three treatments being compared
on device before one is chosen.

---

## Why the first three attempts failed

Three separate mistakes, none of them "the numbers were too subtle":

1. **Shading was painted with strokes.** A stroke lays down a band of *constant*
   colour. A bevel is a *gradient of surface normals*. No combination of alpha and
   width turns one into the other — raising either just produced a thicker outline,
   which is exactly what each "make it more visible" round delivered.
2. **Light was banned outright.** `board-fx.ts` carried the rule "depth is shadow,
   never light", derived from the flat-vector mockup and pinned by a test. That rule
   is correct for the mockup and wrong for cardboard, whose single most identifying
   feature is a *light* cut edge (below).
3. **There was never a height map.** No height map means no normals, and no normals
   means no depth — only hints painted onto a flat shape.

## What cardboard actually is

Chipboard is pressed paper fibre with the printed sheet laminated on top, so:

- The die-cut edge exposes the **grey-tan fibre core, not the image** — a *light*
  rim. This is the cue the eye reads as "cardboard".
- The cut is slightly crushed, so the edge rounds over and catches light.
- The surface is matte: diffuse, not specular.
- Two adjacent cut edges form a groove, so seams show ambient occlusion.

## The technique, and the proof it is available

`@shopify/react-native-skia` 2.6.2 — already a dependency — exposes Skia's lighting
image filters. From `ImageFilterFactory.d.ts`:

```
MakeDistantLitDiffuse(direction, lightColor, surfaceScale, kd, input, cropRect)
  "interpreting the alpha channel of the input as the height profile of the
   surface (to approximate normal vectors)"
```

Blur the silhouette's alpha and the ramp at its boundary *is* a bevel profile; the
filter derives real surface normals from it and shades them. This is the W3C
`feGaussianBlur` → `feDiffuseLighting` bevel, and Skia is the engine behind Chrome's
SVG filters, so it is the same well-trodden path rather than an approximation.

Also confirmed present: `Morphology` (erode/dilate), `FractalNoise`/`Turbulence`,
`DisplacementMap`, SkSL `RuntimeEffect`, `Surface.MakeOffscreen` and
`makeImageSnapshot`.

Two constraints found while checking:

- **Lighting filters are imperative-only.** `renderer/components/imageFilters/`
  has no lighting component, so the overlay must be built through
  `Skia.ImageFilter.MakeDistantLitDiffuse` rather than declaratively.
- **Lighting output is opaque RGBA.** It must be masked back to the silhouette
  (`feComposite operator="in"` in SVG terms) before being blended over the artwork.

## The five layers

1. **Cut-edge core** — erode the alpha, subtract, fill the band with warm grey.
2. **Bevel** — blurred alpha → `MakeDistantLitDiffuse`, light from the top-left,
   masked to the silhouette, blended over the artwork.
3. **Surface grain** — `FractalNoise` at low alpha. Procedural paper texture.
4. **Drop shadow** — raised pieces only; a locked piece is flush and casts nothing.
5. **Seam occlusion** — soft dark just outside the silhouette, so locked
   neighbours sit in a groove.

## No custom assets, and the same decision fixes performance

The overlay depends only on the silhouette, never on the photo — which is what makes
gallery imports work. A silhouette is fully determined by its four edge codes, so
there are at most **3⁴ = 81** distinct shapes per cell size, not one per puzzle.

Bake them once at puzzle load into cached `SkImage`s via `Surface.MakeOffscreen` +
`makeImageSnapshot`, keyed by edge signature. Each piece then draws as *photo clipped
to path* + *cached overlay*: two draws, **no filters per frame**. That is strictly
less per-frame work than the current implementation, which runs a blurred stroke and
a shadow filter on every piece on every frame — so this should reduce the reported
drag latency rather than add to it.

### Rejected alternatives

| Approach | Why not |
| --- | --- |
| Baked art per puzzle | Impossible for gallery imports, and multiplies by grid size |
| Live filters every frame | Wasteful: the overlay is static once the shape is known |
| A 3D renderer | An entire second rendering stack for one effect |
| Artist-supplied PNG overlays | Cannot adapt to cell size, and procedural output makes them unnecessary |

## Open risks

- Lighting filters need verifying on the target GPU. Baking at load contains the
  cost, but the bake itself must be measured.
- Bevel width has to scale with cell size. At 10×10 a cell is 29 board units, where
  a fixed bevel may be too fine to read at all.
- `MakeDistantLitDiffuse` shades with white light; blending it over the artwork needs
  a mode that both lightens and darkens (`overlay`/`hardLight`), not `multiply`.

## What is being compared

A dev-only lab screen renders one piece three ways at high zoom, captured on device:

1. **Current** — blurred inward stroke.
2. **Full cardboard** — all five layers, including the light fibre core.
3. **Bevel only** — lit bevel and dark edge, no light core, closer to the mockup.

The user picks from the capture. The art direction is a genuine choice, not a
technical one: the mockup is flat-vector and cardboard is not, so adopting cardboard
means the board diverges from the mockup while the rest of the app keeps it.
