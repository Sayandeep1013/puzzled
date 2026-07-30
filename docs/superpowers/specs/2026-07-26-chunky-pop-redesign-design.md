# Design Spec — "Chunky Pop" redesign + product architecture (v1)

Date: 2026-07-26 · Supersedes the theme direction in
`docs/superpowers/specs/2026-07-24-game-screen-reimagine-design.md` (the board
mechanics from that doc are revised here, not discarded).

The hand-drawn `design/handdrawn-v1` experiment was reviewed by the team and not
adopted. This spec replaces it with a new visual direction and, for the first
time, writes down what Puzzled actually is, which screens exist, how they
connect, and what the backend looks like.

---

## 1. Product definition

Puzzled is a **cozy jigsaw collection game with a daily challenge layer and a
non-coercive free-to-play economy.**

Three things are true at once, in priority order:

1. **Cozy is the core.** Relax-and-complete. Curated packs, gentle progression,
   your own photos. No timers that punish, no failure states.
2. **Daily gives it a heartbeat.** One shared puzzle per day, personal streaks,
   and a global/country leaderboard so there is a reason to open the app today.
3. **The economy funds it without gating it.** Coins, hints, cosmetic themes,
   premium packs, remove-ads, rewarded ads.

### Explicit non-goals

- **No energy or lives system, ever.** This was decided deliberately. "Relax, no
  pressure" and "wait 30 minutes for a life" train opposite habits, and cozy
  puzzle audiences punish energy gates in reviews. Every other F2P mechanic is
  in scope; this one is out. If it is ever revisited it must be a product
  decision, not an implementation convenience.
- **No friend graph, no chat, no activity feed.** Social is exactly one thing: a
  daily leaderboard with anonymous accounts and a chosen nickname.
- **No user-photo sharing.** Imported photos stay on-device. This keeps us out
  of user-generated-content moderation entirely.

---

## 2. Audit of what exists today

### Real and working

| Area | State |
| --- | --- |
| `src/game-engine/` | Solid. Pure TS, deterministic, 59 passing tests. Generation, jigsaw paths, layout, snap, completion. |
| Grid sizes 3×3–10×10 | Working, per-size progress |
| SQLite progress | Working, per `(puzzle, gridSize)`, resumes on reopen |
| Photo import | Working, copies into app storage |
| Library screen | Reads real progress summaries |
| Skia board | Renders, drags, snaps |

### Painted but hollow — the honest list

| Screen | What is fake |
| --- | --- |
| Achievements | All 6 achievements hardcoded with invented progress (`26/50`, `5/7`) |
| Shop | Coin balance hardcoded `9866`; every button fires `Alert('Coming soon')` |
| Profile | Name and email hardcoded `Puzzle Master` / `puzzlemaster@mail.com`; Statistics, Settings, Help all `Alert` |
| Daily | Calendar renders real dates but there is no daily rotation — it just shows `bundled[0]` |
| Explore | 5 categories that filter nothing; "See all" links go nowhere |
| Game — Hint | Same static string every time: "Look for a corner piece first" |
| Game — Sound/Music | Local `useState` only. **The app has no audio at all.** |
| Game — toolbar Back | Duplicate of the header back button |

### Board defects (as reported)

1. **Ghost preview gives away the answer.** `GhostTarget` in
   `src/features/game/puzzle-board.tsx:167` draws an accent-coloured silhouette
   at the solved slot the moment a piece is grabbed. `FloatingPiece` compounds
   it by magnet-pulling the rendered piece toward `solvedCenterCanvas`. This was
   an intentional feature in commit `455f72c`; it is being reversed.
2. **Grab feels laggy and unreliable.** The Pan handler requires 5px of travel
   *and* passes a direction gate (`dy < -6 || |dy| >= |dx|`) before a piece
   lifts, so a slow or sideways grab scrolls the tray instead.
3. **A miss is punishing.** `placeFromTray` teleports the piece back to the tray
   with no feedback if it lands outside the threshold.
4. **No zoom.** At 8×8 and 10×10 the pieces are too small to aim at. Pinch-zoom
   existed in `455f72c` (`use-board-camera.ts`) and was removed in `fd846e9`.

---

## 3. Screen map and navigation

### Tabs (4)

| Tab | Purpose | Change |
| --- | --- | --- |
| **Home** | Continue card, today's daily + streak, pack rail, recently played | Rebuild |
| **Puzzles** | Pack/collection browser, real category filters, search | Rename from Explore, make filters real |
| **Library** | In Progress · Completed · Favourites · My Photos (import lives here) | Add Favourites + My Photos tabs |
| **Profile** | Stats summary, entries to Achievements / Statistics / Settings / Shop | Replace hardcoded identity with real nickname |

### Pushed routes

| Route | Status |
| --- | --- |
| `daily` | Exists — add real rotation, streak, leaderboard tab |
| `pack/[packId]` | **New** — a collection's puzzles, progress, lock state |
| `difficulty/[puzzleId]` | Exists — restyle |
| `game/[puzzleId]` | Exists — major rework, §6 |
| `results/[puzzleId]` | Exists — add coins earned, share, next-puzzle |
| `achievements` | Exists — drive from real progress |
| `statistics` | **New** — replaces `Alert('Statistics')` |
| `settings` | **New** — replaces `Alert('Settings')`; sound, music, haptics, account, restore, privacy |
| `leaderboard` | **New** — daily global + country |
| `shop` | Exists — wire to real wallet |
| `onboarding` | **New** — first-run nickname + anonymous auth (Phase 2) |

### Router tree

```
src/app/
  _layout.tsx              root stack · fonts · audio · theme · settings providers
  onboarding.tsx           NEW (Phase 2)
  (tabs)/
    _layout.tsx            PopTabBar
    index.tsx              Home
    puzzles.tsx            RENAMED from explore.tsx
    library.tsx
    profile.tsx
  pack/[packId].tsx        NEW
  difficulty/[puzzleId].tsx
  game/[puzzleId].tsx
  results/[puzzleId].tsx
  daily.tsx
  leaderboard.tsx          NEW
  achievements.tsx
  statistics.tsx           NEW
  settings.tsx             NEW
  shop.tsx
```

Route files stay parse-params-and-render only, per the `TECH.md` rule.

---

## 4. Design system — "Chunky Pop"

Neo-brutalist pop, **softened**: the confidence of thick outlines and hard
shadows, with no sharp corners anywhere, and a much broader colour range.

### Principles

- Every surface has a **3px ink outline** and a **hard offset shadow with zero
  blur**. Never a soft grey shadow.
- **Nothing is square.** Generous radii on every element, including small chips.
- **Colour is loud and everywhere.** Cards, chips, and icons cycle a bright
  palette rather than defaulting to white-on-white.
- **Press is physical.** Pressing translates the element into its own shadow.
- **Photos are the hero.** Chrome is loud but sits *around* artwork, never over.

### Tokens (`src/shared/theme.ts`)

```
colors
  ink        #141414   outlines, shadows, primary text
  inkMuted   #5C5A57
  paper      #FFF8EC   app background
  surface    #FFFFFF   card fill
  grape      #7B5CFF   primary CTA
  bubblegum  #FF5CA8
  tangerine  #FF7A3D
  sunshine   #FFC93C   coins, progress
  mint       #2ED9A0   success, completion
  sky        #3DBEFF
  cherry     #FF4757   destructive, streak flame

radii    sm 14 · md 22 · lg 32 · xl 44 · pill 999
shadow   default 4/4 · hero 6/6 · pressed 2/2 · offset only, blur 0
border   3px standard · 2px on chips under 40pt
spacing  unchanged (xs4 sm8 md16 lg24 xl32 xxl48)
```

`accentRamp` is an ordered array of the six brights; lists index into it by
position so colour assignment is deterministic and never repeats adjacently.

### Typography

- **Display:** Fredoka 600/700 via `@expo-google-fonts/fredoka` — headings,
  buttons, numbers.
- **Body:** Nunito 400/700/800 via `@expo-google-fonts/nunito`.
- Ramp: `hero 44 · title 30 · heading 22 · label 13 · body 16 · caption 13`.
- Loaded with `useFonts` in the root layout, splash-gated.

### Motion

Reanimated 4 springs throughout, `damping 14 / stiffness 180` — a slight
overshoot on everything. Entering lists stagger 40ms per row.

### Components (`src/shared/ui/`)

Build:

| New | Role |
| --- | --- |
| `PopSurface` | outline + offset shadow + radius + fill. The core primitive. |
| `PopButton` | press-into-shadow animation, colour variants, icon slot |
| `PopIcon` | Phosphor wrapper bound to theme weight/colour |
| `PopTabBar` | chunky pill tab bar |
| `PopToggle` `PopChip` `PopProgress` `PopBadge` `PopSheet` `PopHeader` | |
| `AnimatedArt` | Lottie wrapper — isolates the runtime so it can be swapped later |

Delete: `SketchFrame`, `SketchButton`, `SketchIcon`, `SketchTabBar`,
`SketchToggle`, `PaperBackground`, and (on the design branch) `sketch.ts`.

`PopSurface` and `PopButton` are plain React Native views with `borderWidth` and
an offset shadow view — **not** Skia. Skia stays for the board only. This is a
deliberate reversal of the hand-drawn approach: the wobble needed Skia, chunky
outlines do not, and RN views are cheaper and accessible by default.

---

## 5. Dependencies to add

All versions are the ones Expo SDK 57 pins in
`node_modules/expo/bundledNativeModules.json`. Install with `npx expo install`.

| Package | Version | Why |
| --- | --- | --- |
| `react-native-svg` | 15.15.4 | Required by every icon library |
| `phosphor-react-native` | latest | ~9,000 icons, 6 weights incl. Fill and Duotone — the chunky filled look |
| `lottie-react-native` | ~7.3.8 | Celebration, empty states, badge unlocks |
| `expo-audio` | ~57.0.2 | SFX + music, makes the toggles real |
| `@expo-google-fonts/fredoka` | latest | Display face |
| `@expo-google-fonts/nunito` | latest | Body face |

**Rejected, with reasons:**

- **Moti** — built on Reanimated 3 and does not support Reanimated 4
  ([nandorojo/moti#391](https://github.com/nandorojo/moti/issues/391)). This
  project is on 4.5.0. Reanimated 4's own spring and layout APIs cover the need.
- **Rive** — measurably faster than Lottie in React Native, but it is not in
  Expo's bundled module map, needs a config plugin with pinned native SDK
  versions, and requires authoring `.riv` files in Rive's editor. Deferred. The
  `AnimatedArt` wrapper exists so individual animations can migrate later
  without touching screens.

Adding native modules means the dev build must be rebuilt (`npm run android`).

---

## 6. Game board rework

### 6.1 Remove the answer reveal

- Delete `GhostTarget` (`puzzle-board.tsx:167-175`) and its render site.
- Remove the magnet pull from `FloatingPiece` — the rendered piece follows the
  finger exactly.
- **The snap itself stays.** `dropPiece` still locks a piece released within
  `snapThreshold`. The player gets the satisfying lock; they are simply no
  longer told the answer in advance.
- `FX.magnetRatio` / `FX.magnetPull` are removed from `board-fx.ts`.

### 6.2 Instant, reliable grab

- Touch-down on a tray piece or a loose board piece lifts it immediately — no
  5px dead zone, no direction gate.
- Implement as `Gesture.Simultaneous(Gesture.Exclusive(doubleTap, pan), pinch)`,
  with the pan's activation decided at `onBegin` by hit-testing the touch point
  rather than by waiting for movement direction.
- Lift is a spring: scale → `FX.liftScale`, shadow grows, light haptic, pickup
  SFX.
- Tray scrolling stays available by starting a drag on empty tray space.

### 6.3 Free placement

The engine already supports this — `LayoutMode = 'tray' | 'scatter'` exists at
`src/game-engine/core/layout.ts:30`, `dropPiece` accepts an arbitrary position,
and `raisePiece` handles re-grabbing. **No engine changes are required**; only
the renderer currently forces tray-only.

- A piece released on the board outside snap range **stays where it was
  dropped**, unlocked, and can be re-grabbed and nudged.
- A piece released over the tray returns to the tray.
- Only proximity to the solved position locks it.
- Loose board pieces render above locked pieces, below the floating piece.

### 6.4 Camera

Recover `use-board-camera.ts` from git — `git show
455f72c:src/features/game/use-board-camera.ts` — rather than rewriting it. It
already implements pinch-zoom, one-finger pan, double-tap zoom, and clamping,
all UI-thread only with zero React re-renders.

Adapt it to the current fitted-board layout: camera applies to the board zone
only, the tray strip stays pinned and unscaled. Clamp 1×–3×.

### 6.5 Juice — restrained

Confirmed in:

- Lift scale + growing shadow on grab
- Drag tilt from velocity, **capped at 4°**
- Overshoot spring on release
- Lock thunk: medium haptic + SFX + the existing expanding `GlowRing`
- **Neighbour jiggle** — on lock, already-placed orthogonal neighbours do a
  ~120ms low-amplitude wobble

Explicitly *not* in: cartoon squash-and-stretch. Every value lives in the `FX`
object in `board-fx.ts` so the feel is tunable in one file without hunting
through render code.

### 6.6 Hints become real

A hint costs one hint token from the wallet.

| Hint | Cost | Behaviour |
| --- | --- | --- |
| **Show me one** | 1 token | Highlights one correct tray piece and flashes its home slot, then places it on tap |
| **Edges** | free | Existing edge-highlight toggle |
| **Preview** | free | Existing full-image preview |

Note the symmetry: "Show me one" *is* the ghost preview — deliberate, paid, and
requested. That is precisely why the free always-on version felt wrong.

### 6.7 Every button gets a use

| Button | Fix |
| --- | --- |
| Toolbar `Back` | Remove — duplicate of header back. Replace with **Shuffle tray**. |
| Pause `Sound` / `Music` | Wire to `expo-audio`, persist in settings |
| Pause — new `Haptics` | Existing `expo-haptics` calls currently cannot be turned off |
| Profile `Statistics` / `Settings` / `Help` | Real screens |
| Explore `See all` / categories | Real pack list and real filters |
| Shop | Real coin and hint purchases against the local wallet |

---

## 7. Data and backend architecture

### 7.1 Model

**Local-first. SQLite stays the source of truth for play.** The server is for
identity, the daily puzzle, leaderboards, entitlements, and cross-device
restore. The app is fully playable with no network and no account.

A `sync_queue` table records local deltas and drains when online. The existing
interfaces in `src/data/repositories.ts` are already the correct seam — remote
adapters implement the same ports.

### 7.2 Supabase

Chosen over Firebase (Postgres fits leaderboards and ledgers far better than a
document store) and over a custom Node stack (no DevOps to maintain).

**Schema**

| Table | Key columns |
| --- | --- |
| `profiles` | `id` → `auth.users`, `nickname` citext unique, `country_code`, `created_at` |
| `packs` | `id`, `slug`, `title`, `cover_key`, `is_premium`, `price_coins`, `released_at` |
| `puzzles` | `id`, `pack_id`, `title`, `image_key`, `width`, `height`, `default_grid_size` |
| `daily_puzzles` | `date` PK, `puzzle_id`, `grid_size`, `seed` — seeded 30 days ahead |
| `daily_results` | PK `(user_id, date)`, `elapsed_ms`, `hints_used`, `completed_at` |
| `progress` | PK `(user_id, puzzle_id, grid_size)`, mirrors local SQLite |
| `wallets` | `user_id` PK, `coins`, `hints` |
| `ledger` | append-only `(user_id, delta_coins, delta_hints, reason, ref, created_at)` — the real source of truth for balances |
| `achievements` | `key` PK, `title`, `description`, `goal`, `icon`, `tier` |
| `user_achievements` | PK `(user_id, key)`, `progress`, `unlocked_at` |
| `entitlements` | `(user_id, sku, source, granted_at, expires_at)` — remove-ads, themes |
| `streaks` | `user_id` PK, `current`, `longest`, `last_played_on` |

**RLS**: `packs`, `puzzles`, `daily_puzzles`, `achievements` are public-read.
Everything else is `user_id = auth.uid()`. `wallets` and `entitlements` are
**read-only to the client** — only Edge Functions write them.

**Edge Functions**

| Function | Role |
| --- | --- |
| `submit-daily-result` | Sanity-checks `elapsed_ms`, writes the result, updates the streak, credits coins. The client never grants itself currency. |
| `daily-leaderboard` | Top N plus the caller's rank, by date and country |
| `grant-purchase` | RevenueCat webhook → `entitlements` + ledger credit |
| `rotate-daily` | `pg_cron`, keeps `daily_puzzles` seeded ahead |

**Auth**: anonymous sign-in on first launch, nickname at onboarding, optional
later linking to Apple/Google so progress survives reinstall.

**Storage**: public `puzzle-art` bucket behind the Supabase CDN. The bundled
catalog remains the offline seed.

**Config**: `EXPO_PUBLIC_SUPABASE_URL` and
`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — the names already in `.env.example`.

### 7.3 Economy rules

Coins are earned by completing puzzles (scaled by grid size), first-time pack
completion, daily streak milestones, and rewarded ads. They are spent on hints,
cosmetic themes, and premium packs. Balances are always derived from `ledger`,
never from a mutable counter, so a desync is recoverable.

---

## 8. Phasing

This is too large for one implementation pass. Each phase is independently
shippable and gets its own plan.

**Phase 1 — Chunky Pop + board, fully local** *(the agreed first deliverable)*
Design tokens and `Pop*` components · add react-native-svg, Phosphor, Lottie,
expo-audio, fonts · board rework (§6) · replace fake data with real local data:
wallet, hints, achievements derived from progress, daily rotation from the
bundled catalog, persisted settings. **No server. No fake numbers anywhere.**

Screens in Phase 1 — every existing route repainted, plus these new ones:

| Screen | In Phase 1? | Why |
| --- | --- | --- |
| Home, Puzzles, Library, Profile, Difficulty, Game, Results, Daily, Achievements, Shop | Yes | Exist today; repainted and de-faked |
| `settings` | Yes | Purely local (sound, music, haptics) — needed to make the pause toggles real |
| `statistics` | Yes | Derives entirely from local progress rows |
| `pack/[packId]` | Yes | Bundled catalog grouped into local packs; no server needed |
| `leaderboard` | **No — Phase 3** | Requires accounts and a server |
| `onboarding` | **No — Phase 2** | Nickname only means something once auth exists |

**Phase 2 — Supabase foundation** Schema, RLS, anonymous auth, onboarding
nickname, progress sync, art CDN.

**Phase 3 — Daily + leaderboard** Rotation, streaks, submission with
validation, leaderboard screen.

**Phase 4 — Monetization** RevenueCat IAP, AdMob rewarded ads, entitlements,
cosmetic themes.

**Phase 5 — Content** Pack pipeline, seasons.

### Branching

- Phase 1 on `design/chunky-pop-v1`, merged to `main` once approved.
- `design/sticker-scrapbook` created locally as a placeholder for the parked
  second direction. **Not pushed.**

---

## 9. Verification

Per phase:

- `npm run typecheck` — clean
- `npm run lint` — 0 problems
- `npm test` — the 59 engine tests must stay green; the engine is not being
  changed, so any failure means the rework leaked into it
- New unit tests for the wallet ledger, hint spend, achievement derivation, and
  daily rotation
- `npm run android` on a device — the board is gesture and haptic driven and
  cannot be judged from a simulator or a test run. Confirm by hand: no ghost
  appears on grab; a piece lifts the instant it is touched; a missed drop stays
  on the board; pinch-zoom works at 10×10; neighbours jiggle on lock; sound
  toggles actually silence audio.
