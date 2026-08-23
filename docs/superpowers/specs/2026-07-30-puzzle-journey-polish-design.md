# Design Spec — Puzzle Journey polish pass

Date: 2026-07-30 · Branch `design/puzzle-journey-v1`
Follows the re-skin landed in `be5a84e`, `ebf4654`, `104911d`, `b648c76`.

The re-skin swapped the design system and the art. This pass fixes what a
device audit then exposed: the Home screen does not read like the team's mockup,
several screens clip content, Daily is inert, and the board lacks depth.

Every item below was reproduced on a real device (Android 16, SDK 36) via
`puzzled://` deep links. Screenshots informed each diagnosis.

---

## 1. Audit findings

### Home

| # | Symptom | Root cause |
| --- | --- | --- |
| 1 | No meadow background | `background image.png` delivered but unused |
| 2 | Sky/grass seam slices through cards while scrolling | `skyBand` is `position:absolute` at `52%` of the **screen**, so it cannot track content |
| 3 | Play / Daily / Album not full width | `maxWidth: 320` on `playNow` and `quickRow` |
| 4 | Title is plain text | No wordmark treatment |
| 5 | Tab bar covers the last content | Tab screens reserve no space for the bar |
| 6 | Progress, starters and import crowd the page | All on one screen |
| 7 | Starter card shows salmon/teal blobs | Home never resolves the bundled image; `previewUri` is passed only for user photos |
| 8 | Cards slide under the coin pill | Pill and gear sit outside the ScrollView with no offset |

### Other screens

| # | Screen | Symptom |
| --- | --- | --- |
| 9 | Daily | Calendar entirely inert — no date is tappable |
| 10 | Daily | Play button clipped by the screen bottom |
| 11 | Daily | No bottom scroll room |
| 12 | Profile | Bear avatar clipped by the circular surface's `overflow:hidden` |
| 13 | Puzzles | "All puzzles · 1 puzzle" header renders with nothing beneath it |
| 14 | Library | Opens on Completed rather than In Progress |
| 15 | Library | Selected chip colour varies per tab via `accentAt` |
| 16 | Game | Large dead cream margins above and below the board |
| 17 | Game | Fourth tray piece cut off with no scroll affordance |
| 18 | All | Primary CTA is darker than passive coloured cards, inverting hierarchy |
| 19 | Shop/Settings/Statistics | Long empty tails below content |

### Reported separately by the user

| # | Symptom | Root cause |
| --- | --- | --- |
| 20 | Board grid not rounded or shadowed | Only the cream shell is; the grid inside is a bare square |
| 21 | Tray does not scroll | It scrolls only from empty slot space (`mode.value === 2`); a full strip leaves none |
| 22 | Neighbour jiggle too strong | `FX.jiggleAmplitude: 2` over `jiggleMs: 120` |
| 23 | Post-lock glow too loud and orange | `GlowRing`, `colors.apricot`, `strokeWidth 3`, opacity from `0.85`, `420ms` |
| 24 | Pieces look flat, not 3D like the mockup | No bevel is drawn |

---

## 2. Piece depth (item 24) — procedural, never per-puzzle assets

The mockup's pieces read as 3D because each carries a **light rim on its
top-left edge and a dark rim on its bottom-right**. This is an emboss derived
from the piece silhouette, not painted artwork.

**This must be procedural, and not merely for convenience.** Baking bevels into
artwork would require one asset per piece, per grid size, per puzzle — a single
image spans 9 to 100 pieces across the supported 3×3–10×10 range, so 384 assets
for one photo. More decisively, **gallery imports could never work**: there is no
opportunity to pre-render art for a photo the player picked seconds ago.

The engine already produces what the effect needs. `core/edges.ts` generates
piece edges, `rendering/skia-path.ts` converts them to an `SkPath`, and
`puzzle-board.tsx` already clips each piece's image to that path. The bevel is
two more draws against the same path, so bundled art and imported photos light
identically through one code path.

```tsx
<Group clip={skPath}>
  <Image … />
</Group>
<Path path={skPath}>
  <Shadow inner dx={-2} dy={-2} blur={3} color="rgba(255,255,255,0.38)" />
  <Shadow inner dx={2}  dy={2}  blur={3} color="rgba(58,43,26,0.32)" />
</Path>
```

`inner?: boolean` is confirmed present on `ShadowProps` in the installed
`@shopify/react-native-skia` 2.6.2 — no upgrade required.

Cost is two GPU draw operations per piece. Acceptable at 100 pieces; if a 10×10
board ever regresses, restrict the bevel to locked pieces plus the dragged one,
which is where depth is legible anyway.

A non-`inner` `<Shadow>` on the floating piece supplies the "lifted" read.

---

## 3. Home rebuild

Home becomes the mockup and nothing else: background, coin pill and gear,
wordmark, mascot, full-width Play, full-width Daily Puzzle + My Album, tab bar.

**Background.** `background image.png` moves to `assets/backgrounds/home.png`
and renders as one `ImageBackground` with `resizeMode="cover"` behind the whole
screen. This resolves items 1 and 2 together — a single image has no seam to
misalign, so the `skyBand` view is deleted rather than repositioned.

**Wordmark (item 4).** A `WordmarkTitle` component, built in React Native rather
than blocked on an asset: `PUZZLE` as per-letter `Text` cycling `accentRamp`
with a white `textShadow` outline, `JOURNEY` in white on a sky pill. The team can
replace it with real art later behind the same component boundary.

**Full width (item 3).** `maxWidth: 320` is removed from `playNow` and
`quickRow`; both stretch to the content width.

**Scroll offset (item 8).** The top bar stays pinned, and the scroll content is
padded by its height so cards never slide beneath it.

### Relocations (item 6)

Each section moves to the screen that already owns its data:

| Section | New home | Why |
| --- | --- | --- |
| Your progress | `statistics` | Already derives from the same `listSummaries()` rows |
| Ready to play? / starters | `puzzles` | Fills the empty "All puzzles" section, resolving item 13 in the same move |
| Add from gallery | `library` → My Photos | Its empty state already reads "Import a photo from Home", which becomes correct once the button lives there |

Nothing is deleted. `PuzzleCard` moves to Puzzles with item 7 fixed on the way:
it resolves bundled art through `resolvePuzzleImageSource` instead of falling
back to decorative blobs.

---

## 4. Tab bar space (item 5)

`PopTabBar` owns its own metrics, so it exports the reservation rather than
letting each screen guess:

```ts
export function useTabBarSpace(): number;  // bar height + bottom safe-area inset
```

Every screen under `(tabs)/` pads its scroll content by this. No magic numbers,
and changing the bar's padding cannot silently start clipping content again.

---

## 5. Daily — keep the calendar, make it live (items 9–11)

The calendar stays; it becomes interactive.

`pickDailyPuzzle(dateKey)` is already deterministic, so a tapped date can show
**that date's real pick** — interactive without inventing data:

- **Today** — tappable, plays today's puzzle.
- **Past dates** — tappable, select that date and show its deterministic pick.
- **Future dates** — disabled, visually locked.

Selecting a date updates the feature image and the Play button beneath. With one
bundled puzzle every date resolves to `First Light`, which matches the requested
behaviour of showing the default image for each day.

Bottom padding and safe-area insets stop the Play button being clipped.

---

## 6. Board and tray (items 16, 17, 20–23)

**Rounded, shadowed board (20).** The grid gets a rounded clip and a soft Skia
shadow so it reads as a card, consistent with every other surface.

**Dead margins (16).** The board zone is tightened so the board fills its shell
instead of floating in cream.

**Tray scrolling (17, 21).** The tray already scrolls, but only from empty slot
space — a full strip offers none, which is why it feels static. The grab stays
instant (Task 11's dead-zone removal is preserved): a piece lifts on touch, and
if the gesture resolves as a horizontal swipe within a few pixels, it hands off
to tray scroll and sets the piece back down. Standard carousel-versus-item
behaviour, with no reintroduced grab latency. An edge fade signals more pieces.

**Jiggle (22).** `FX.jiggleAmplitude` drops from 2 to 1, with a softer curve.

**Glow (23).** `GlowRing` moves from `colors.apricot` to a very low-alpha green,
`strokeWidth` 3 → 1.5, peak opacity 0.85 → 0.28, duration 420ms → 600ms so it
fades out rather than blinking.

---

## 7. Remaining fixes

- **Profile avatar (12).** The pink circle is removed. `change-avatar` already
  carries its own white sticker outline; clipping it to a circle was the defect.
- **Library (14, 15).** Defaults to In Progress; the selected chip is always
  `grass` instead of cycling `accentAt`.
- **Hierarchy (18).** Remaining coloured info cards move to cream so the green
  CTA is again the most saturated element on any screen.
- **Empty tails (19).** Screens centre or cap their content so short lists do not
  leave a long blank run.

---

## 8. Verification

- `npm run typecheck` — clean
- `npm run lint` — 0 problems
- `npm test` — all green; engine tests must not move, as the engine is untouched
- New tests: `useTabBarSpace` reserves the bar; Daily date selection is
  deterministic per `dateKey`; `WordmarkTitle` renders every letter
- `npx expo export --platform android` — exit 0
- Device pass over each changed screen via `puzzled://` deep links. Blind `adb`
  tapping is not used: during the audit it escaped the app into unrelated
  applications, exposing the user's personal data. Deep links are deterministic
  and stay inside the app.
