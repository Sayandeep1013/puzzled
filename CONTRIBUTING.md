# Contributing to Puzzled

How to get productive on this repo and how we work on it together.

- **Setting up and running the app** → [README.md](./README.md)
- **Why the architecture is the way it is** → [TECH.md](./TECH.md)
- **This file** → onboarding path, conventions, and the rules that are easy to break by accident

---

## Your first 30 minutes

**1. Check your Node version.** Everything else fails confusingly if this is wrong.

```bash
node -v    # must be 22.13.0 or newer
```

**2. Clone and install.** Use `npm ci`, not `npm install` — it installs the exact locked tree.

```bash
git clone https://github.com/Sayandeep1013/puzzled.git
cd puzzled
npm ci
```

**3. Prove it works without a device.** The game engine is pure TypeScript and needs no emulator.
Do this before touching Android tooling — if this fails, your install is broken and no amount of
Android setup will help.

```bash
npm test
npm run typecheck
npm run lint
```

Expect all tests green.

**4. Now pick how you run the actual app:**

| Situation                                 | Path                                                   |
| ----------------------------------------- | ------------------------------------------------------ |
| You have (or will install) Android Studio | README → **Option A**. Best loop: hot reload on device |
| Clean machine, no Android SDK             | README → **Option B**. Cloud APK + Metro               |
| You only need a shareable APK to look at  | README → **Option C**                                  |
| You are only changing engine logic        | `npm test` — skip the device entirely                  |

Option A takes longer up front (large SDK download) and is worth it if you are touching UI, gestures,
or rendering. If you are working purely in `src/game-engine/core`, you may never need it.

**5. Get access if you will make builds.** Cloud builds need an Expo account added to the
`sayandeep1013` organisation. Ask the repo owner, then `eas login`. You do not need this to develop
locally.

---

## The daily loop

```bash
npx expo start --dev-client   # start Metro, open the installed Puzzled app
```

Only rebuild native code (`npm run android`, or a new EAS build) when native dependencies or
`app.json` plugins change. Pure JS/TS changes hot-reload.

After pulling someone else's dependency change:

```bash
npm ci
npm run clean:caches   # if Metro serves something stale
```

---

## Before you open a PR

```bash
npm test && npm run typecheck && npm run lint && npm run format:check
```

All four must pass. Then:

- Keep PRs scoped to one layer where you can — engine, UI, or data
- Commit `package-lock.json` alongside any dependency change
- If you changed anything visual, say how you verified it (device, emulator, or rendered output)

---

## Architecture rules

These are the ones that cause real damage when broken.

### The engine stays pure

`src/game-engine/core/` must never import React, Skia, SQLite, or anything from `react-native`.

That purity is why the engine has fast unit tests and no emulator dependency. Skia adapters live in
`src/game-engine/rendering/`; anything React-shaped belongs in `src/features/`.

If you need engine logic in a component, export a function from the engine and call it — do not move
the component's concerns into the engine.

### Dependency direction is one-way

```text
routes → features → engine + repository interfaces → local adapters
```

Nothing flows back up. `data/` must not import from `features/`.

### Generation must stay deterministic

Piece shapes, edge signs, and tray positions all derive from a seeded RNG. The same seed must always
produce the same board, because saved sessions store absolute piece positions and are replayed
against freshly generated geometry.

Never introduce `Math.random()` or `Date.now()` into generation or layout. Use `createSeededRng`.

### Changing generation math breaks saved games

If you change piece geometry, edge generation, or layout in a way that moves pieces, **bump
`GENERATOR_ALGORITHM_VERSION` in `core/constants.ts`**.

Saved sessions are validated by `isSessionCompatible()` against puzzle revision, grid size, and piece
ids. Bumping the version changes the generated board so stale saves are discarded cleanly instead of
restoring pieces onto geometry that no longer matches.

---

## Cookbook

### Add a puzzle

Two edits, no other code changes:

1. Add the image to `assets/puzzles/`
2. Register it in `src/data/local/puzzle-assets.ts` (Metro needs a literal `require`)
3. Add the catalog entry in `src/data/local/local-puzzle-repository.ts`

`gridSize` accepts `4 | 6 | 8 | 9 | 10`. Use 4 for feel-testing; production boards are 8–10.

### Change how pieces look

`KNOB_PROFILE` and `TAB_SIZE_RATIO` in `core/constants.ts` control the whole silhouette.

The profile is expressed as cubic segments in normalised edge space (`t` along the edge, `k` outward
in tab-size units). **It must stay symmetric about `t = 0.5`.** Two neighbouring pieces walk the same
shared edge in opposite directions with opposite sign — symmetry is the only reason a tab and its
blank produce the same curve. Break it and pieces stop mating.

`mating.test.ts` will catch that: it walks every interior edge of an 8×8 board and compares real
generated points from both pieces.

### Change snap feel

`DEFAULT_SNAP_THRESHOLD_RATIO` in `core/constants.ts` — a fraction of cell size. Higher is more
forgiving.

### Add a field to saved progress

`GameSession` is serialised to JSON wholesale into `puzzle_sessions.session_json`, so adding an
optional field needs no migration. Adding a **queryable column** does — extend the schema in
`SQLiteProgressRepository.initialize()` with a fresh `CREATE TABLE IF NOT EXISTS` plus an `ALTER
TABLE` guard, since existing installs already have the old table.

---

## Verifying visual changes without a device

Geometry bugs are very hard to see by reading path math, and easy to see in a picture. Because the
engine is pure TypeScript, you can render its real output on a desktop:

1. In a scratch folder outside the repo: `npm i sharp`
2. Write a script that imports from `src/game-engine/core/path.ts`, converts `PathCommand[]` into an
   SVG `d` string, and rasterises it with `sharp`
3. Run it with `npx tsx`

This is how the tray-ordering bug was found — the code looked correct and the render immediately
showed the tray re-assembling the photograph. Worth doing for any change to `path.ts`, `layout.ts`,
or `edges.ts`.

---

## Gotchas

**Reanimated and the React Compiler disagree.** `puzzle-board.tsx` opens with an
`eslint-disable` for `react-hooks/immutability`, `refs`, and `purity`. Gesture handlers legitimately
mutate `.value` and read refs. Keep that suppression scoped to that file — do not widen it or add it
to new files without a reason you can explain.

**Worklets run on the UI thread.** Anything inside `Gesture.*` callbacks cannot touch React state
directly; hop with `runOnJS`. That hop is asynchronous, which is why the gesture code carries a
`gestureActive` flag — a tap can finish before the JS callback lands.

**Skia offscreen surfaces belong to the render thread.** `Skia.Surface.MakeOffscreen` called from
React render code returns a GPU surface whose snapshots are invalid on the thread that actually draws
them — every piece rendered blank on device while type checks, lint, and tests stayed green. If you
cache piece rendering, do it in a worklet, `<Atlas>`, or a recorded `Picture`, and confirm on real
hardware.

**`Link asChild` overwrites the child's `style` prop.** A `Pressable` inside a `Link` loses its own
styling, which silently erased the Start button's fill. Put visuals on an inner `View`. A bare
`Pressable` outside a `Link` is unaffected — that asymmetry is what makes it confusing.

**There is no `babel.config.js`, on purpose.** `babel-preset-expo` auto-injects
`react-native-worklets/plugin` when the package is installed. Adding a hand-written Babel config
risks losing that.

**Do not casually remove "unused" Expo dependencies.** Several are transitive dependencies or
required peers of `expo-router`; removing them saves nothing or breaks routing. Check what depends on
a package before dropping it.

**Board sizing is measured once.** `PuzzleBoard` captures its world extent on mount so the canvas
does not rescale mid-drag. If you change initial layout, remount the board (its `key` includes the
puzzle id, revision, and reset generation) rather than expecting it to re-measure.
