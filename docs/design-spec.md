# Design Spec — Hand-Drawn "Puzzle Journey" (v1)

Branch: `design/handdrawn-v1`. This is the source-of-truth spec for the hand-drawn
theme experiment. Reference mockup: `screen_idea_1.jpeg` (repo root). When we
approve a direction, this doc is what gets finalized and merged toward `main`.

> Status: **experiment / not final.** Illustrations are procedural placeholders.
> Coins, achievements, favorites, and settings persistence are mocked.

---

## 1. Vision

A warm, calm, storybook feel — like playing inside a hand-drawn sketchbook. The
signature is the **wobbly ink border** on every surface, a **cream paper**
backdrop, **handwritten titles**, and soft muted colors. Nothing is crisp or
"appy"; everything looks drawn by hand.

**Principles**
- Every container is a hand-drawn frame, not a flat rectangle.
- Warm paper, never pure white backgrounds.
- Handwritten display type for personality; rounded sans for readability.
- Muted, earthy palette — no neon, no hard shadows, no glossy gradients.
- Motion stays gentle; the mood is "slow down and relax."

---

## 2. Foundations

### Palette (`src/shared/theme.ts` → `colors`)
| Token | Hex | Use |
|---|---|---|
| canvas | `#F6F2EA` | app paper background |
| surface | `#FFFCF6` | card fills |
| kraft | `#EFE6D2` | behind art / previews |
| ink / inkSoft | `#2B2622` / `#172121` | text, sketch strokes |
| inkMuted | `#6B6357` | secondary text |
| primary | `#8E7BA6` | primary CTA (dusty purple) |
| gold | `#E7B95A` | highlight / secondary buttons, coins |
| sage | `#B9CDBD` | success / progress fills |
| rose | `#D89B93` | avatar / accents |
| accent | `#E86E45` | terracotta highlights, tags |
| sketch | `#4A4239` | hand-drawn border ink |

### Typography (`theme.ts` → `fonts`, `typography`)
- **Display:** Patrick Hand (`fonts.display`) — titles, buttons, numbers with character.
- **Body:** Nunito 400/700/800 — copy, labels, dense lists.
- Ramp: `hero 46 · title 30 · heading 22 · label 13 · body 16 · caption 13`.
- Loaded via `@expo-google-fonts/*` + `useFonts` in `src/app/_layout.tsx`, splash-gated.

### Spacing / radii
Existing tokens: `spacing xs4…xxl48`, `radii sm10 md18 lg28 pill999`.

---

## 3. Component system (`src/shared/ui/`)

All hand-drawn chrome is **Skia-rendered** (no `react-native-svg`, no native rebuild).

| Component | Role |
|---|---|
| `PaperBackground` | full-bleed cream + faint procedural grain |
| `SketchFrame` | the core: seeded, wobbly, double-stroked rounded border; optional fill |
| `SketchButton` | filled `SketchFrame` + label; `primary` / `gold` / `plain` |
| `SketchIcon` | doodle line-icon set (nav, categories, toolbar, settings…) drawn as Skia paths |
| `SketchTabBar` | bottom nav (Home / Explore / Library / Profile) |
| `SketchToggle` | hand-drawn on/off switch |
| `ScreenHeader` | back chevron + centered title + right slot |
| `sketch.ts` | seeded rough-path generator (deterministic wobble) |

**Rule:** wobble is seeded per instance (`seed` prop) so borders don't shimmer on
re-render. Line icons are free and infinitely scalable — prefer extending
`SketchIcon` over adding image assets for anything expressible as line art.

---

## 4. Navigation

- **Tabs** (`src/app/(tabs)/`): Home · Explore · Library · Profile — custom `SketchTabBar`.
- **Pushed screens**: `difficulty/[puzzleId]`, `game/[puzzleId]`, `results/[puzzleId]`,
  `daily`, `shop`, `achievements`.
- **In-game overlays** (not routes): Pause, Hint, Preview — local state in `game-screen`.

**Core flow:** Home/Explore → Select Difficulty → Game → (Pause/Hint/Preview) →
Well Done → Play Again / Home. Profile → Shop / Achievements. Home → Daily.

---

## 5. Screens (all 12)

| Screen | File | Data | Notes |
|---|---|---|---|
| Home | `features/home/home-screen.tsx` | real | hero piece, Play Now, progress, quick links |
| Explore | `features/explore/` | real catalog + mock categories | category chips, recommended, popular |
| Select Difficulty | `features/difficulty/` | real | piece-count tiles → routes with `size` |
| Game | `features/game/` | real | timer, board shell, toolbar, overlays |
| Hint | overlay | mock text | corner-piece tip |
| Pause | overlay | mock toggles | sound/music, Restart (real), Exit |
| Well Done | `features/results/` | real time/pieces | trophy, Play Again |
| My Library | `features/library/` | real progress + mock favorites | In Progress / Completed / Favorites |
| Daily Puzzle | `features/daily/` | real calendar + featured | taped photo |
| Shop | `features/shop/` | mock | coin packs, remove-ads |
| Profile | `features/profile/` | real completed count + mock stats | links to Shop/Achievements |
| Achievements | `features/achievements/` | mock | badge list + progress |

**Board engine is untouched** — `features/game/puzzle-board.tsx` and everything under
`src/game-engine/` are the existing engine; the redesign only reskins chrome.

---

## 6. Assets — what still needs real art

Procedural placeholders live in ready-made slots (swap = one line per slot; see
`docs/asset-pipeline.md`).

- Hero golden puzzle piece · trophy · avatar portrait · glowing hint piece
- Category tiles (nature/animals/cities/art/food) · achievement badges
- Coin/coin-stack · decorative stickers (tape, stars, confetti)

Everything else — line icons, borders, textures, fonts, layout — is **done in code**.

---

## 7. Decisions on record
- Skia for all vector chrome (already installed) → **no `react-native-svg`, no native rebuild.**
- Patrick Hand + Nunito (legible over more scribbly options like Caveat/Gaegu).
- Vertical slice first, then all 12 as themed screens; features behind mock screens deferred.
- Fresh puzzle → Difficulty screen; Continue/replay → straight to board.

## 8. Open questions (decide before finalizing)
- Real illustration source: AI-batch (LoRA/Scenario) vs commissioned? (see asset-pipeline.md)
- Which screens get real backends first (coins economy? achievements tracking? daily rewards?).
- Keep terracotta `accent` or go fully purple/gold for CTAs.
- Favorites: real flag in the data layer vs drop the tab.
- Tab set: is 4 (Home/Explore/Library/Profile) final, or fold Explore into Home?

## 9. Verification
`npm run typecheck` · `npm run lint` (only pre-existing `data/index.ts` errors) ·
`npm test` (59 pass). On-device: run the EAS `development` build and compare each
screen against `screen_idea_1.jpeg`; confirm the board still plays after reskin.
