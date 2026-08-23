# Game Screen Reimagining — "Zoomable board, juicy snap"

**Date:** 2026-07-24
**Branch:** `main` (changes land directly on main, per user request)
**Status:** Approved design — ready for implementation plan

## Problem

The puzzle actually plays poorly. `src/features/game/puzzle-board.tsx` scales the
**entire world** (board + all loose pieces) to fit the viewport on both axes:

```
scale = min(1, viewport.width / world.width, viewport.height / world.height)
```

For anything past a 4×4, that shrinks pieces to a few millimetres. There is no
zoom, no pan, and no tactile payoff — snapping a piece home is silent and
instant, dragging tiny shapes is frustrating. It feels stale and is genuinely
hard to play.

## Goal

Make the board **bigger and fun**: pieces are a comfortable working size at any
grid, you can move around the board freely, and placing a piece *feels* good —
magnetic pull, a satisfying snap with a pop/glow, a haptic thud, and a real
celebration on completion.

## Non-Goals (v1)

- No engine changes. `@/game-engine` (generation, layout, session, snap/lock
  semantics) stays byte-for-byte. All 59 existing tests must stay green.
- No change to the saved-session format or `isSessionCompatible` — resuming an
  in-progress game keeps working.
- No piece **rotation** gameplay (the `rotation` field stays 0, as today).
- No separate scrollable "tray" UI — loose pieces remain positioned in the same
  world and **stay where you drop them** (the current model). Reachable by pan.
- No change to `game-screen.tsx` chrome, its Pause/Hint/Preview overlays, or the
  other 11 screens.

## Key decision: the engine is authoritative; animation is cosmetic

The engine commits state instantly and exactly — `dropPiece` locks a piece at
its solved position the moment it's within `snapThreshold`. The new juice (spring
into slot, glow, magnetic pull) only interpolates the **rendered** position/scale
for ~180 ms on top of already-committed state. This keeps saves, completion
detection, and progress counts correct and race-free while still feeling alive.

## Architecture

Today `puzzle-board.tsx` is one ~470-line file doing measurement, camera math,
gesture handling, hit-testing, and Skia rendering. Split it into focused units
with clear boundaries:

| Unit | File | Responsibility | Depends on |
|---|---|---|---|
| Camera hook | `src/features/game/use-board-camera.ts` | Owns camera transform (scale + translateX/Y as Reanimated shared values), fit-to-content, clamping, double-tap zoom, screen↔world mapping worklets. No engine coupling. | reanimated |
| Board FX | `src/features/game/board-fx.ts` | Haptics wrappers (`impact`, `success`, no-op on web) + shared constants for snap/lift/glow timing. | expo-haptics |
| Board | `src/features/game/puzzle-board.tsx` | Composes camera + drag gesture + Skia scene; renders board surface, static pieces, floating piece, ghost target, glow, confetti. Keeps its current props. | engine, camera, fx |

`PuzzleBoard`'s public props are unchanged:

```ts
interface PuzzleBoardProps {
  generated: GeneratedPuzzle;
  session: GameSession;
  imageSource: number | string;
  onSessionChange: (session: GameSession) => void;
}
```

`game-screen.tsx` keeps its structure (timer, header, toolbar, overlays) and
gets **two small edits only**: a ~1.2 s celebration beat before the Results
handoff (section 3), and wiring the previously-disabled **Edges** button to a
render toggle passed into `PuzzleBoard` (section 4). Nothing else in it moves.

## 1. Camera system (the core fix)

- **Default zoom** is computed from grid size so an individual piece is ≈ 64–72 pt
  on screen (a comfortable thumb target) instead of fitting the whole world.
  Camera starts centred on the board.
- **Gestures** (composed, simultaneous where sensible):
  - **Pan (1 finger):** if a draggable piece is under the touch → drag the piece
    (section 2); otherwise → pan the camera.
  - **Pinch (2 fingers):** zoom about the focal midpoint.
  - **Double-tap:** toggle between "fit board" and a 2× close-up centred on the
    tapped point.
- **Clamps:** min zoom = "fit the whole world" (board + loose pieces always
  reachable); max zoom ≈ 3×. Translation is clamped so content keeps a margin
  on-screen and can't be flung away.
- **Thread model:** camera transform is applied to the Skia root `Group` via
  `useDerivedValue` on the UI thread. Panning/zooming triggers **zero** React
  re-renders. Screen→world mapping is `(p − translate) / scale`, used by
  hit-testing and drop math (replacing today's static `x/scale − padding`).

## 2. Piece drag + magnetic snap (the feel)

- **Grab:** the piece lifts — rendered scale ≈ 1.08, stronger shadow/outline,
  raised in z — and a **light** impact haptic fires. (Z-order is still committed
  to the session on drop, not on grab, to avoid a full re-render mid-touch.)
- **Approach:** while dragging within ~1.6 × `snapThreshold` of its solved slot,
  draw a faint **ghost target** (the piece's silhouette at the solved position)
  and apply a gentle **magnetic pull**, easing the rendered piece toward the slot
  as the finger nears.
- **Drop in range:** engine `dropPiece` locks it at the solved position. The
  rendered piece **springs** from the drop point into the slot (~180 ms), a
  **pop** (scale 1.12 → 1.0) plus an expanding **glow ring** fades out, and a
  **medium** impact haptic fires.
- **Drop out of range:** the piece stays exactly where dropped (unchanged rule).

The magnetic pull is a render/threshold nicety only — the actual snap decision
remains `isWithinSnapDistance(position, solvedPosition, snapThreshold)`. We may
pass a modestly larger effective threshold for the *visual* pull than for the
*commit*, but the commit rule itself is the engine's.

## 3. Completion celebration

When the incoming `session.status === 'completed'` (final lock):

1. **success** notification haptic,
2. a **confetti** burst — Skia particles driven by a Reanimated clock, particle
   count capped (≈ 80) — over the finished picture,
3. the assembled image briefly **pulses brighter**,
4. then the existing handoff to Results fires after a short beat (~1.2 s).

`game-screen.tsx` currently pushes to Results the instant `complete` flips true.
We add a ~1.2 s delay there (or expose an `onCompleteCelebrated` callback from
the board) so the celebration is actually seen. This is the only change to
`game-screen.tsx`.

## 4. Toolbar (low-risk bonus)

- **Preview** and **Hint** already work as overlays in `game-screen.tsx`. Keep.
- **Edges** is currently disabled. Wire it to a **"highlight border pieces"**
  toggle: any piece with a flat outer edge (`edges.{top,right,bottom,left} === 0`)
  gets a subtle accent outline/tint so the player can do edges-first. This is a
  pure render flag derived from geometry — no engine or state change.
  **If it proves fiddly it is cut; it is a bonus, not core.**
- Double-tap already provides recenter/fit, so no separate control is required.

## 5. Haptics

Add `expo-haptics`. Wrap it in `board-fx.ts`:

```ts
export function impact(kind: 'light' | 'medium'): void  // no-op on web
export function success(): void                         // no-op on web
```

Fired only from JS-thread callbacks (grab, drop, complete) — never from a
worklet. Covered by the fresh EAS dev build the user is about to run.

## 6. Performance

- Keep the memoized `StaticPiece` — only the dragged piece re-renders on drag.
- Camera transform is UI-thread only (no re-render on pan/zoom).
- Ghost target + glow are a couple of extra nodes tied to the active piece.
- Confetti mounts only on completion and is capped.
- Target the same 100–300 piece range the current build already handles.

## Testing / Verification

- `npm run typecheck`, `npm run lint`, `npm test` (expect 59/59 unchanged — no
  engine touched) all clean before building.
- The interaction itself (gestures, snap feel, haptics, confetti) is verified
  **on-device** via the EAS dev build → adb install → Metro, since gesture +
  native-haptic behaviour can't be unit-tested meaningfully.
- Manual device checklist: pinch/pan/double-tap; grab + drag a piece; magnetic
  ghost near a slot; snap pop + glow + haptic; resume a saved game; complete a
  small grid and see confetti + Results handoff; Edges toggle highlights borders.

## Risks & mitigations

- **Gesture composition** (grab-vs-pan + pinch) is the fiddly part → build
  incrementally, prove on device.
- **expo-haptics** native module → resolved by the fresh EAS build.
- **Confetti perf** → Skia-only, capped particle count, mounts only at the end.
- **Camera + saved sessions** → camera is pure viewport; it never writes session
  state, so resume/compat is unaffected.
