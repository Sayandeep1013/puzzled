# Puzzle Journey art source

These 68 SVGs are the **source of truth** for the app's icon and illustration
set. The app does not read them at runtime — `scripts/build-art.mjs` rasterizes
them into `assets/art/*.png` at three densities, and those PNGs are committed.

## Why PNG and not SVG

Measured on this exact set:

| Pipeline | Payload | Runtime cost |
| --- | --- | --- |
| SVG via `react-native-svg` | 5.13 MB of path data after SVGO | rebuilds native paths on every mount; `coin-chest-10000` alone is 1.09 MB |
| PNG @1x/2x/3x (chosen) | 2.01 MB total | none — Metro picks the density, the OS decodes a bitmap |

The art is flat multicolour illustration, so it never needs runtime tinting —
the one thing vector would have bought us.

## Changing the art

```sh
npm i --no-save sharp svgo
node scripts/build-art.mjs
```

`sharp` and `svgo` are deliberately **not** project dependencies: the generated
PNGs are committed, so a normal install and a normal EAS build never touch this
path.

If you add or rename an SVG, update the registry in `src/shared/art.ts` — it is
a hand-maintained union type, which is what makes `<Art name="…">` typo-proof.

Size class is assigned per asset in `scripts/build-art.mjs`:

| Class | Box | Used for |
| --- | --- | --- |
| `ICON` | 64pt | UI icons — back, gear, pause, toolbar, puzzle pieces |
| `MEDIUM` | 128pt | shop bundles, achievement badges, category art |
| `HERO` | 224pt | mascots only |

Class is a **memory** decision, not a disk one: a decoded PNG costs
`w × h × 4` bytes in RAM whatever its file size, so promoting an icon to hero
resolution wastes megabytes on screens that show twenty at once.

## Still needed from the design team

The re-skin ships against solid background tints and the one bundled puzzle.
These slots are wired and will pick up real art with **no code changes**:

| Slot | Spec | Drop at |
| --- | --- | --- |
| Puzzle artwork | square, 1024×1024 PNG, one file per puzzle | `assets/puzzles/<id>.png`, then add the row to `src/data/local/local-puzzle-repository.ts` |
| Home scene background | 2:3 portrait PNG, ≥1200×1800, sky at top and grass at the bottom | `assets/art-source/` as `home-scene.svg`, or `assets/backgrounds/home.png` |
| Purple bird mascot | appears in the mockup's Choose Mode and Difficulty panels but is **absent from this set** | `assets/art-source/bird.svg` |
| `PUZZLE JOURNEY` wordmark | transparent PNG or SVG, ~3:1 | `assets/art-source/wordmark.svg` |
| "Amazing!" celebration wordmark | optional; Results currently renders it as text | `assets/art-source/amazing.svg` |

## Known inconsistencies in the current set

Flagged, not fixed — these are the design team's call:

- `save-exit` is a realistic grey floppy disk; every other asset is flat
  cartoon. It reads as foreign.
- `profile` is a generic orange silhouette while the mockup's Profile tab shows
  the bear head (`change-avatar`). The tab bar uses `change-avatar`.
- `minus` is a bare red bar while `plus` is a green cross and `plus-circle` is a
  circled cross — the pair does not match.
- Near-duplicates kept because both may be wanted: `home`/`quit-home`,
  `resume`/`play`, `chest`/`chest-open`/`gold-chest`, `cup`/`cup-star`/`my-trophies`,
  `reward`/`reward-alt`, `happy-duck`/`winking-duck`, `bear`/`bear-excited`.
