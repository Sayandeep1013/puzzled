# Chunky Pop — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the rejected paper/sketch theme with the "Chunky Pop" design system, rework the puzzle board so it feels instant and forgiving without revealing answers, and delete every hardcoded number from the UI — all fully local, no server.

**Architecture:** A token-driven component library (`src/shared/ui/Pop*`) built from plain React Native views — outline plus a sibling offset shadow view — replaces the Skia-drawn `Sketch*` components. Skia stays for the puzzle board only. New local persistence (wallet ledger, settings, achievements, daily rotation) follows the existing repository-port pattern in `src/data/`, so Phase 2's Supabase adapters can implement the same interfaces. The game engine in `src/game-engine/` is not modified.

**Tech Stack:** Expo SDK 57 · React Native 0.86 · React 19.2 · TypeScript 6 · Reanimated 4.5 · Gesture Handler 2.32 · Skia 2.6.2 · expo-sqlite · react-native-svg 15.15.4 · phosphor-react-native · lottie-react-native 7.3.8 · expo-audio 57.0.2

## Global Constraints

- **Expo SDK 57 only.** Read `https://docs.expo.dev/versions/v57.0.0/` before using any Expo API. Install native deps with `npx expo install`, never bare `npm install`, so versions match `node_modules/expo/bundledNativeModules.json`.
- **Exact pinned versions:** `react-native-svg@15.15.4`, `lottie-react-native@~7.3.8`, `expo-audio@~57.0.2`. Reanimated stays `4.5.0`.
- **Do not add Moti.** It requires Reanimated 3; this project is on 4.5.0.
- **`src/game-engine/core` must not import React, React Native, Skia, or SQLite.** All 59 existing engine tests must stay green — a failure means the rework leaked into the engine.
- **Route files parse params and render a feature screen. No business logic.** (`TECH.md` rule.)
- **No hardcoded gameplay numbers in any screen.** Every count, balance, time, and progress value comes from a repository. This is the acceptance bar for Phase 1.
- **Custom fonts encode weight in the family name.** Never combine `fontFamily: 'Fredoka_700Bold'` with `fontWeight` — set family only.
- **Shadows are offset, blur 0.** Never `elevation` (Android always blurs it) and never `shadowRadius > 0`. Use the sibling-view technique in `PopSurface`.
- **Branching:** work on `design/chunky-pop-v1`. Also create `design/sticker-scrapbook` locally as a placeholder for the parked direction — **do not push it**.
- Verification per task: `npm run typecheck`, `npm run lint`, `npm test`.
- **Do not run `npm run android` or any device build.** Steps in this plan labelled "verify on device" are performed by the human at milestone boundaries. Where a task has such a step, do the code work, run the three gates above, and list the device-observable behaviour that still needs hands-on confirmation in your report under a `## Needs device verification` heading. Never report a device behaviour as verified.

---

## File Structure

**Created**

| Path | Responsibility |
| --- | --- |
| `src/shared/tokens.ts` | Colour, radius, border, shadow, spacing, spring primitives. No React. |
| `src/shared/theme.ts` | *(rewritten)* Re-exports tokens + font families + type ramp |
| `src/shared/ui/PopSurface.tsx` | Core primitive: outline + hard offset shadow + radius + fill |
| `src/shared/ui/PopButton.tsx` | Press-into-shadow button, colour variants, icon slot |
| `src/shared/ui/PopIcon.tsx` | Curated Phosphor icon map bound to theme tokens |
| `src/shared/ui/PopTabBar.tsx` | Chunky bottom tab bar |
| `src/shared/ui/PopToggle.tsx` | On/off switch |
| `src/shared/ui/PopChip.tsx` | Filter/category pill |
| `src/shared/ui/PopProgress.tsx` | Outlined progress bar |
| `src/shared/ui/PopSheet.tsx` | Modal overlay card |
| `src/shared/ui/PopHeader.tsx` | Back chevron + title + right slot |
| `src/shared/ui/AnimatedArt.tsx` | Lottie wrapper — isolates the runtime for later Rive swap |
| `src/data/local/settings-repository.ts` | Sound/music/haptics prefs in SQLite |
| `src/data/local/wallet-repository.ts` | Append-only ledger; balance is always derived |
| `src/data/local/achievements-repository.ts` | Achievement definitions + progress derivation |
| `src/data/daily.ts` | Deterministic daily puzzle selection from the bundled catalog |
| `src/features/game/use-board-camera.ts` | *(recovered from commit `455f72c`)* pinch/pan/double-tap camera |
| `src/features/game/board-audio.ts` | SFX + music playback, gated on settings |
| `src/features/settings/settings-screen.tsx` | Real settings screen |
| `src/features/statistics/statistics-screen.tsx` | Real stats derived from progress |
| `src/features/pack/pack-screen.tsx` | Pack detail |
| `src/app/settings.tsx`, `src/app/statistics.tsx`, `src/app/pack/[packId].tsx` | Route entries |

**Deleted**

`src/shared/ui/SketchFrame.tsx` · `SketchButton.tsx` · `SketchIcon.tsx` · `SketchTabBar.tsx` · `SketchToggle.tsx` · `PaperBackground.tsx` · `ScreenHeader.tsx`

**Modified**

`src/shared/ui/index.ts` · `src/app/_layout.tsx` (fonts, providers) · `src/app/(tabs)/_layout.tsx` · every file in `src/features/*/` · `src/features/game/puzzle-board.tsx` (major) · `src/features/game/board-fx.ts` · `src/data/index.ts` · `src/data/local/database.ts`

**Renamed**

`src/app/(tabs)/explore.tsx` → `puzzles.tsx`; `src/features/explore/` → `src/features/puzzles/`

---

# Milestone A — Foundation

### Task 1: Dependencies, fonts, and the branch

**Files:**
- Modify: `package.json`, `package-lock.json`
- Modify: `src/app/_layout.tsx`

**Interfaces:**
- Produces: fonts loaded under family names `Fredoka_600SemiBold`, `Fredoka_700Bold`, `Nunito_400Regular`, `Nunito_700Bold`, `Nunito_800ExtraBold`.

- [ ] **Step 1: Create the working branch and the parked placeholder**

```bash
git checkout -b design/chunky-pop-v1
git branch design/sticker-scrapbook
```

Do **not** push `design/sticker-scrapbook`.

- [ ] **Step 2: Install native dependencies with the Expo resolver**

```bash
npx expo install react-native-svg lottie-react-native expo-audio
npx expo install phosphor-react-native @expo-google-fonts/fredoka @expo-google-fonts/nunito
npm install --save-dev @testing-library/react-native@^13.3.3
```

- [ ] **Step 3: Verify the resolved versions match Expo's pins**

Run: `node -e "const p=require('./package.json').dependencies;console.log(p['react-native-svg'],p['lottie-react-native'],p['expo-audio'])"`

Expected: `15.15.4 ~7.3.8 ~57.0.2`

If any differ, run `npx expo install --check` and accept its fixes.

- [ ] **Step 4: Register the testing library preset**

In `package.json`, add to the `jest` block:

```json
"setupFilesAfterEnv": ["@testing-library/react-native/extend-expect"]
```

- [ ] **Step 5: Load fonts in the root layout**

Replace the body of `src/app/_layout.tsx`:

```tsx
import { Fredoka_600SemiBold, Fredoka_700Bold, useFonts } from '@expo-google-fonts/fredoka';
import { Nunito_400Regular, Nunito_700Bold, Nunito_800ExtraBold } from '@expo-google-fonts/nunito';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors } from '@/shared/theme';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [ready, error] = useFonts({
    Fredoka_600SemiBold,
    Fredoka_700Bold,
    Nunito_400Regular,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });

  useEffect(() => {
    // Hide on error too: a missing font must not leave the user on a splash forever.
    if (ready || error) {
      void SplashScreen.hideAsync();
    }
  }, [ready, error]);

  if (!ready && !error) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            contentStyle: { backgroundColor: colors.paper },
            headerShown: false,
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="difficulty/[puzzleId]" />
          <Stack.Screen name="game/[puzzleId]" />
          <Stack.Screen name="results/[puzzleId]" />
          <Stack.Screen name="pack/[packId]" />
          <Stack.Screen name="daily" />
          <Stack.Screen name="shop" />
          <Stack.Screen name="achievements" />
          <Stack.Screen name="statistics" />
          <Stack.Screen name="settings" />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
```

This will not typecheck until Task 2 renames `colors.canvas` to `colors.paper`. That is expected.

- [ ] **Step 6: Rebuild the dev client**

Native modules were added, so Metro alone is not enough.

Run: `npm run android`
Expected: app installs and launches (still in the old theme).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/app/_layout.tsx
git commit -m "build: add svg, phosphor, lottie, audio, and display fonts"
```

---

### Task 2: Design tokens

**Files:**
- Create: `src/shared/tokens.ts`
- Create: `src/shared/tokens.test.ts`
- Modify: `src/shared/theme.ts`

**Interfaces:**
- Produces: `colors` (with `ink`, `inkMuted`, `paper`, `surface`, `grape`, `bubblegum`, `tangerine`, `sunshine`, `mint`, `sky`, `cherry`), `accentAt(index: number): string`, `radii`, `border`, `shadow`, `spacing`, `springs.pop`, `fonts`, `typography`. All consumed via `@/shared/theme`.

- [ ] **Step 1: Write the failing test**

Create `src/shared/tokens.test.ts`:

```ts
import { accentAt, accentRamp, colors, radii } from './tokens';

describe('accentAt', () => {
  it('cycles through the ramp', () => {
    expect(accentAt(0)).toBe(accentRamp[0]);
    expect(accentAt(accentRamp.length)).toBe(accentRamp[0]);
    expect(accentAt(1)).toBe(accentRamp[1]);
  });

  it('handles negative indices without throwing', () => {
    expect(accentAt(-1)).toBe(accentRamp[accentRamp.length - 1]);
  });

  it('never returns the same colour for adjacent indices', () => {
    for (let i = 0; i < 20; i += 1) {
      expect(accentAt(i)).not.toBe(accentAt(i + 1));
    }
  });
});

describe('tokens', () => {
  it('has no sharp corners', () => {
    for (const value of Object.values(radii)) {
      expect(value).toBeGreaterThanOrEqual(14);
    }
  });

  it('uses near-black ink rather than pure black', () => {
    expect(colors.ink).toBe('#141414');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/shared/tokens.test.ts`
Expected: FAIL — `Cannot find module './tokens'`

- [ ] **Step 3: Write the tokens**

Create `src/shared/tokens.ts`:

```ts
/**
 * Chunky Pop primitives. No React, no React Native — importable from tests and
 * from any layer. Screens import these through `@/shared/theme`.
 */

export const colors = {
  // Ink is used for every outline, every shadow, and primary text. Slightly off
  // black so large filled areas do not vibrate against the warm paper.
  ink: '#141414',
  inkMuted: '#5C5A57',

  paper: '#FFF8EC',
  surface: '#FFFFFF',

  grape: '#7B5CFF',
  bubblegum: '#FF5CA8',
  tangerine: '#FF7A3D',
  sunshine: '#FFC93C',
  mint: '#2ED9A0',
  sky: '#3DBEFF',
  cherry: '#FF4757',

  /** Text placed on top of a saturated fill. */
  onFill: '#FFFFFF',
} as const;

/**
 * Ordered brights. Lists index into this so colour assignment is deterministic
 * across renders — a card must not change colour when the list re-sorts.
 */
export const accentRamp = [
  colors.grape,
  colors.bubblegum,
  colors.tangerine,
  colors.sunshine,
  colors.mint,
  colors.sky,
] as const;

export function accentAt(index: number): string {
  const length = accentRamp.length;
  return accentRamp[((index % length) + length) % length];
}

/** Nothing in this theme has a sharp corner. */
export const radii = { sm: 14, md: 22, lg: 32, xl: 44, pill: 999 } as const;

export const border = { thin: 2, standard: 3 } as const;

/** Hard offset shadow distances, in points. Blur is always zero. */
export const shadow = { pressed: 2, default: 4, hero: 6 } as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;

/** Every motion in the app overshoots slightly. */
export const springs = {
  pop: { damping: 14, stiffness: 180, mass: 0.8 },
  snappy: { damping: 20, stiffness: 320, mass: 0.6 },
} as const;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/shared/tokens.test.ts`
Expected: PASS, 5 tests

- [ ] **Step 5: Rewrite the theme barrel**

Replace `src/shared/theme.ts` entirely:

```ts
export { accentAt, accentRamp, border, colors, radii, shadow, spacing, springs } from './tokens';

/**
 * Weight is encoded in the family name for custom fonts. Never pair these with
 * a `fontWeight` — on Android that silently picks a synthesised face.
 */
export const fonts = {
  display: 'Fredoka_600SemiBold',
  displayBold: 'Fredoka_700Bold',
  body: 'Nunito_400Regular',
  bodyBold: 'Nunito_700Bold',
  bodyBlack: 'Nunito_800ExtraBold',
} as const;

export const typography = {
  hero: { fontFamily: fonts.displayBold, fontSize: 44, letterSpacing: -1 },
  title: { fontFamily: fonts.displayBold, fontSize: 30, letterSpacing: -0.5 },
  heading: { fontFamily: fonts.display, fontSize: 22 },
  label: { fontFamily: fonts.bodyBlack, fontSize: 13, letterSpacing: 1.2 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23 },
  bodyStrong: { fontFamily: fonts.bodyBold, fontSize: 15 },
  caption: { fontFamily: fonts.bodyBold, fontSize: 13 },
} as const;
```

- [ ] **Step 6: Add temporary compatibility aliases**

Every unconverted screen still imports `colors.canvas`, `colors.sage`, and friends. Without aliases the branch would not typecheck from here until Task 16, which would disable `npm run typecheck` as a gate for fourteen consecutive task reviews. Append to `src/shared/theme.ts`:

```ts
/**
 * TEMPORARY. Maps the retired paper-theme names onto Chunky Pop so screens keep
 * compiling while they are converted one at a time in Milestone D.
 *
 * Task 17 asserts that no source file references any of these. Delete this block
 * when that assertion passes — it must not survive Phase 1.
 */
export const legacyColors = {
  canvas: tokens.paper,
  surfaceStrong: tokens.surface,
  kraft: tokens.sunshine,
  inkSoft: tokens.ink,
  primary: tokens.grape,
  primaryPressed: tokens.grape,
  accent: tokens.tangerine,
  accentPressed: tokens.tangerine,
  gold: tokens.sunshine,
  goldPressed: tokens.sunshine,
  sage: tokens.mint,
  rose: tokens.bubblegum,
  line: tokens.ink,
  sketch: tokens.ink,
  shadow: tokens.ink,
} as const;
```

Import the token module as `* as tokens` at the top of `theme.ts`, and spread `legacyColors` into the exported `colors` object so existing `colors.canvas` call sites resolve unchanged.

- [ ] **Step 7: Verify the branch still typechecks**

Run: `npm run typecheck`
Expected: clean. If any error mentions a colour name, add it to `legacyColors`.

- [ ] **Step 8: Commit**

```bash
git add src/shared/tokens.ts src/shared/tokens.test.ts src/shared/theme.ts
git commit -m "feat(theme): add Chunky Pop tokens and type ramp"
```

---

### Task 3: PopSurface

**Files:**
- Create: `src/shared/ui/PopSurface.tsx`
- Test: `src/shared/ui/PopSurface.test.tsx`

**Interfaces:**
- Consumes: `colors`, `radii`, `border`, `shadow` from `@/shared/theme` (Task 2)
- Produces: `PopSurface`, props `{ children?, fill?: string, radius?: number, offset?: number, borderWidth?: number, style?: StyleProp<ViewStyle>, contentStyle?: StyleProp<ViewStyle>, testID?: string }`

The offset shadow is a sibling `View`, not a platform shadow. `elevation` always blurs on Android and `shadowRadius: 0` is iOS-only, so neither produces the hard edge this theme requires. The wrapper reserves `offset` points of padding on the right and bottom so the shadow never overflows its parent's layout.

- [ ] **Step 1: Write the failing test**

Create `src/shared/ui/PopSurface.test.tsx`:

```tsx
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { colors, radii, shadow } from '@/shared/theme';

import { PopSurface } from './PopSurface';

describe('PopSurface', () => {
  it('renders its children', () => {
    const { getByText } = render(
      <PopSurface>
        <Text>hello</Text>
      </PopSurface>,
    );
    expect(getByText('hello')).toBeTruthy();
  });

  it('reserves layout space for the offset shadow', () => {
    const { getByTestId } = render(<PopSurface testID="surface" offset={shadow.hero} />);
    expect(getByTestId('surface')).toHaveStyle({
      paddingRight: shadow.hero,
      paddingBottom: shadow.hero,
    });
  });

  it('draws the shadow in ink with no blur radius', () => {
    const { getByTestId } = render(<PopSurface testID="surface" />);
    const shade = getByTestId('surface-shadow');
    expect(shade).toHaveStyle({ backgroundColor: colors.ink });
    expect(shade.props.style).not.toHaveProperty('shadowRadius');
  });

  it('applies the requested fill and radius to the face', () => {
    const { getByTestId } = render(
      <PopSurface testID="surface" fill={colors.mint} radius={radii.lg} />,
    );
    expect(getByTestId('surface-face')).toHaveStyle({
      backgroundColor: colors.mint,
      borderRadius: radii.lg,
      borderColor: colors.ink,
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/shared/ui/PopSurface.test.tsx`
Expected: FAIL — `Cannot find module './PopSurface'`

- [ ] **Step 3: Implement**

Create `src/shared/ui/PopSurface.tsx`:

```tsx
import { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { border, colors, radii, shadow } from '@/shared/theme';

interface PopSurfaceProps {
  children?: ReactNode;
  /** Face colour. */
  fill?: string;
  radius?: number;
  /** Hard shadow distance in points. Blur is always zero. */
  offset?: number;
  borderWidth?: number;
  /** Style for the outer wrapper — use for margins, width, flex. */
  style?: StyleProp<ViewStyle>;
  /** Style for the face — use for padding, alignment. */
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * The Chunky Pop card primitive: an ink-outlined face sitting on a hard,
 * unblurred ink shadow.
 *
 * The shadow is a sibling view rather than a platform shadow because Android's
 * `elevation` always blurs and iOS's `shadowRadius: 0` has no Android
 * equivalent. The wrapper pads right and bottom by `offset` so the shadow is
 * inside this component's layout box and never overlaps a sibling.
 */
export function PopSurface({
  children,
  fill = colors.surface,
  radius = radii.md,
  offset = shadow.default,
  borderWidth = border.standard,
  style,
  contentStyle,
  testID,
}: PopSurfaceProps) {
  return (
    <View testID={testID} style={[{ paddingRight: offset, paddingBottom: offset }, style]}>
      <View
        testID={testID ? `${testID}-shadow` : undefined}
        pointerEvents="none"
        style={[styles.shade, { left: offset, top: offset, borderRadius: radius }]}
      />
      <View
        testID={testID ? `${testID}-face` : undefined}
        style={[
          styles.face,
          { backgroundColor: fill, borderRadius: radius, borderWidth },
          contentStyle,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shade: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: colors.ink,
  },
  face: {
    borderColor: colors.ink,
    overflow: 'hidden',
  },
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/shared/ui/PopSurface.test.tsx`
Expected: PASS, 4 tests

- [ ] **Step 5: Commit**

```bash
git add src/shared/ui/PopSurface.tsx src/shared/ui/PopSurface.test.tsx
git commit -m "feat(ui): add PopSurface offset-shadow primitive"
```

---

### Task 4: PopButton

**Files:**
- Create: `src/shared/ui/PopButton.tsx`
- Test: `src/shared/ui/PopButton.test.tsx`

**Interfaces:**
- Consumes: `PopSurface` (Task 3), `springs`, `typography`
- Produces: `PopButton`, props `{ label: string, onPress?: () => void, tone?: PopTone, size?: 'sm' | 'md' | 'lg', disabled?: boolean, icon?: ReactNode, style?: StyleProp<ViewStyle>, accessibilityLabel?: string }`; exported type `PopTone = 'grape' | 'bubblegum' | 'tangerine' | 'sunshine' | 'mint' | 'sky' | 'cherry' | 'surface'`

Pressing translates the face down-right into its own shadow. Because the shadow view stays fixed, translating the face alone shrinks the visible shadow from `offset` to `shadow.pressed` — one animated value, no shadow re-layout.

- [ ] **Step 1: Write the failing test**

Create `src/shared/ui/PopButton.test.tsx`:

```tsx
import { fireEvent, render } from '@testing-library/react-native';

import { PopButton } from './PopButton';

describe('PopButton', () => {
  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByText } = render(<PopButton label="Play" onPress={onPress} />);
    fireEvent.press(getByText('Play'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', () => {
    const onPress = jest.fn();
    const { getByRole } = render(<PopButton label="Play" onPress={onPress} disabled />);
    fireEvent.press(getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('exposes the label as the default accessibility label', () => {
    const { getByLabelText } = render(<PopButton label="Play" />);
    expect(getByLabelText('Play')).toBeTruthy();
  });

  it('prefers an explicit accessibility label over the visible one', () => {
    const { getByLabelText } = render(
      <PopButton label="3" accessibilityLabel="Three hints remaining" />,
    );
    expect(getByLabelText('Three hints remaining')).toBeTruthy();
  });

  it('marks itself disabled for assistive technology', () => {
    const { getByRole } = render(<PopButton label="Play" disabled />);
    expect(getByRole('button')).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/shared/ui/PopButton.test.tsx`
Expected: FAIL — `Cannot find module './PopButton'`

- [ ] **Step 3: Implement**

Create `src/shared/ui/PopButton.tsx`:

```tsx
import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { border, colors, radii, shadow, spacing, springs, typography } from '@/shared/theme';

export type PopTone =
  | 'grape'
  | 'bubblegum'
  | 'tangerine'
  | 'sunshine'
  | 'mint'
  | 'sky'
  | 'cherry'
  | 'surface';

const FILL: Record<PopTone, string> = {
  grape: colors.grape,
  bubblegum: colors.bubblegum,
  tangerine: colors.tangerine,
  sunshine: colors.sunshine,
  mint: colors.mint,
  sky: colors.sky,
  cherry: colors.cherry,
  surface: colors.surface,
};

/** Sunshine and mint are light enough that white text fails contrast on them. */
const LABEL: Record<PopTone, string> = {
  grape: colors.onFill,
  bubblegum: colors.onFill,
  tangerine: colors.onFill,
  sunshine: colors.ink,
  mint: colors.ink,
  sky: colors.ink,
  cherry: colors.onFill,
  surface: colors.ink,
};

const SIZE = {
  sm: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, fontSize: 15, radius: radii.sm },
  md: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg, fontSize: 18, radius: radii.md },
  lg: { paddingVertical: spacing.md + 4, paddingHorizontal: spacing.xl, fontSize: 22, radius: radii.lg },
} as const;

interface PopButtonProps {
  label: string;
  onPress?: () => void;
  tone?: PopTone;
  size?: keyof typeof SIZE;
  disabled?: boolean;
  /** Rendered before the label — pass a `PopIcon`. */
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function PopButton({
  label,
  onPress,
  tone = 'grape',
  size = 'md',
  disabled = false,
  icon,
  style,
  accessibilityLabel,
}: PopButtonProps) {
  const press = useSharedValue(0);
  const metrics = SIZE[size];
  const travel = shadow.default - shadow.pressed;

  // Only the face moves. The shadow stays put, so the gap between them shrinks
  // from `shadow.default` to `shadow.pressed` — the button presses into the page.
  const faceStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: press.value * travel },
      { translateY: press.value * travel },
    ],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => {
        press.value = withSpring(1, springs.snappy);
      }}
      onPressOut={() => {
        press.value = withSpring(0, springs.pop);
      }}
      style={[{ paddingRight: shadow.default, paddingBottom: shadow.default }, disabled && styles.disabled, style]}
    >
      <View
        pointerEvents="none"
        style={[styles.shade, { left: shadow.default, top: shadow.default, borderRadius: metrics.radius }]}
      />
      <Animated.View
        style={[
          styles.face,
          {
            backgroundColor: FILL[tone],
            borderRadius: metrics.radius,
            paddingVertical: metrics.paddingVertical,
            paddingHorizontal: metrics.paddingHorizontal,
          },
          faceStyle,
        ]}
      >
        {icon}
        <Text style={[styles.label, { color: LABEL[tone], fontSize: metrics.fontSize }]}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shade: { position: 'absolute', right: 0, bottom: 0, backgroundColor: colors.ink },
  face: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: border.standard,
    borderColor: colors.ink,
  },
  label: { fontFamily: typography.heading.fontFamily },
  disabled: { opacity: 0.45 },
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/shared/ui/PopButton.test.tsx`
Expected: PASS, 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/shared/ui/PopButton.tsx src/shared/ui/PopButton.test.tsx
git commit -m "feat(ui): add PopButton with press-into-shadow motion"
```

---

### Task 5: PopIcon and the remaining primitives

**Files:**
- Create: `src/shared/ui/PopIcon.tsx`, `PopToggle.tsx`, `PopChip.tsx`, `PopProgress.tsx`, `PopSheet.tsx`, `PopHeader.tsx`, `PopTabBar.tsx`, `AnimatedArt.tsx`
- Test: `src/shared/ui/PopIcon.test.tsx`, `src/shared/ui/PopProgress.test.tsx`
- Modify: `src/shared/ui/index.ts`
- Delete: `src/shared/ui/SketchFrame.tsx`, `SketchButton.tsx`, `SketchIcon.tsx`, `SketchTabBar.tsx`, `SketchToggle.tsx`, `PaperBackground.tsx`, `ScreenHeader.tsx`

**Interfaces:**
- Produces:
  - `PopIcon`, props `{ name: PopIconName, size?: number, color?: string, weight?: 'regular' | 'bold' | 'fill' | 'duotone' }`; `PopIconName` is the key union of the `ICONS` map below.
  - `PopToggle`, props `{ value: boolean, onChange: (next: boolean) => void, accessibilityLabel: string }`
  - `PopChip`, props `{ label: string, icon?: PopIconName, selected?: boolean, tone?: string, onPress?: () => void }`
  - `PopProgress`, props `{ value: number, goal: number, tone?: string, height?: number }`
  - `PopSheet`, props `{ children: ReactNode, onDismiss: () => void, title?: string }`
  - `PopHeader`, props `{ title: string, right?: ReactNode, onBack?: () => void }`
  - `PopTabBar`, props: expo-router's `BottomTabBarProps`
  - `AnimatedArt`, props `{ source: number, loop?: boolean, autoPlay?: boolean, style?: StyleProp<ViewStyle> }`

The icon map is curated rather than re-exporting all ~9,000 Phosphor icons, so the bundle only carries what is used and screens cannot invent names that do not exist.

- [ ] **Step 1: Write the failing tests**

Create `src/shared/ui/PopIcon.test.tsx`:

```tsx
import { render } from '@testing-library/react-native';

import { colors } from '@/shared/theme';

import { PopIcon } from './PopIcon';

describe('PopIcon', () => {
  it('renders a known icon', () => {
    const { getByTestId } = render(<PopIcon name="puzzle" testID="icon" />);
    expect(getByTestId('icon')).toBeTruthy();
  });

  it('defaults to ink and the fill weight so icons read as chunky', () => {
    const { getByTestId } = render(<PopIcon name="trophy" testID="icon" />);
    const icon = getByTestId('icon');
    expect(icon.props.color).toBe(colors.ink);
    expect(icon.props.weight).toBe('fill');
  });
});
```

Create `src/shared/ui/PopProgress.test.tsx`:

```tsx
import { render } from '@testing-library/react-native';

import { PopProgress } from './PopProgress';

describe('PopProgress', () => {
  it('reports fractional progress to assistive technology', () => {
    const { getByRole } = render(<PopProgress value={3} goal={4} />);
    expect(getByRole('progressbar').props.accessibilityValue).toEqual({
      min: 0,
      max: 4,
      now: 3,
    });
  });

  it('clamps a value above the goal', () => {
    const { getByTestId } = render(<PopProgress value={9} goal={4} testID="bar" />);
    expect(getByTestId('bar-fill')).toHaveStyle({ width: '100%' });
  });

  it('does not divide by zero when the goal is zero', () => {
    const { getByTestId } = render(<PopProgress value={0} goal={0} testID="bar" />);
    expect(getByTestId('bar-fill')).toHaveStyle({ width: '0%' });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/shared/ui/PopIcon.test.tsx src/shared/ui/PopProgress.test.tsx`
Expected: FAIL — modules not found

- [ ] **Step 3: Implement PopIcon**

Create `src/shared/ui/PopIcon.tsx`:

```tsx
import {
  ArrowLeft,
  ArrowsClockwise,
  CalendarBlank,
  CaretRight,
  ChartBar,
  CheckCircle,
  Coins,
  Compass,
  Eye,
  Fire,
  Gear,
  Heart,
  House,
  Image as ImageIcon,
  Lightbulb,
  Medal,
  MusicNotes,
  Palette,
  PawPrint,
  Play,
  Plus,
  PuzzlePiece,
  Question,
  ShoppingBag,
  SignOut,
  SpeakerHigh,
  Sparkle,
  Star,
  Storefront,
  Trophy,
  User,
  X,
  type IconProps,
} from 'phosphor-react-native';
import { type ComponentType } from 'react';

import { colors } from '@/shared/theme';

/**
 * Curated map. Adding an icon is a one-line change here; screens can only use
 * names in this map, so a typo is a type error rather than a blank square.
 */
const ICONS = {
  back: ArrowLeft,
  calendar: CalendarBlank,
  chart: ChartBar,
  check: CheckCircle,
  chevron: CaretRight,
  close: X,
  coin: Coins,
  edges: PuzzlePiece,
  exit: SignOut,
  explore: Compass,
  eye: Eye,
  gear: Gear,
  heart: Heart,
  help: Question,
  hint: Lightbulb,
  home: House,
  library: ImageIcon,
  medal: Medal,
  music: MusicNotes,
  packs: ShoppingBag,
  palette: Palette,
  paw: PawPrint,
  play: Play,
  plus: Plus,
  profile: User,
  puzzle: PuzzlePiece,
  restart: ArrowsClockwise,
  shop: Storefront,
  sound: SpeakerHigh,
  sparkle: Sparkle,
  star: Star,
  streak: Fire,
  trophy: Trophy,
} satisfies Record<string, ComponentType<IconProps>>;

export type PopIconName = keyof typeof ICONS;

interface PopIconProps {
  name: PopIconName;
  size?: number;
  color?: string;
  /** `fill` is the default — outline weights read as thin next to 3px borders. */
  weight?: IconProps['weight'];
  testID?: string;
}

export function PopIcon({
  name,
  size = 24,
  color = colors.ink,
  weight = 'fill',
  testID,
}: PopIconProps) {
  const Glyph = ICONS[name];
  return <Glyph size={size} color={color} weight={weight} testID={testID} />;
}
```

- [ ] **Step 4: Implement PopProgress**

Create `src/shared/ui/PopProgress.tsx`:

```tsx
import { StyleSheet, View } from 'react-native';

import { border, colors, radii, shadow } from '@/shared/theme';

interface PopProgressProps {
  value: number;
  goal: number;
  tone?: string;
  height?: number;
  testID?: string;
}

export function PopProgress({
  value,
  goal,
  tone = colors.mint,
  height = 18,
  testID,
}: PopProgressProps) {
  // A zero goal is a legitimate state for an achievement with no target yet;
  // treat it as empty rather than letting it become NaN%.
  const fraction = goal > 0 ? Math.min(1, Math.max(0, value / goal)) : 0;

  return (
    <View
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: goal, now: value }}
      style={[styles.track, { height, borderRadius: radii.pill }]}
    >
      <View
        testID={testID ? `${testID}-fill` : undefined}
        style={[
          styles.fill,
          { width: `${fraction * 100}%`, backgroundColor: tone, borderRadius: radii.pill },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: colors.surface,
    borderWidth: border.thin,
    borderColor: colors.ink,
    overflow: 'hidden',
    marginBottom: shadow.pressed,
  },
  fill: { height: '100%' },
});
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest src/shared/ui/PopIcon.test.tsx src/shared/ui/PopProgress.test.tsx`
Expected: PASS, 5 tests

- [ ] **Step 6: Implement the remaining primitives**

Build `PopToggle`, `PopChip`, `PopSheet`, `PopHeader`, `PopTabBar`, and `AnimatedArt` on top of `PopSurface` and `PopIcon`, following the conventions already established: ink outlines at `border.standard`, radii from the token scale, `springs.pop` for motion, `accessibilityRole` on every interactive element.

- `PopToggle` — a `pill`-radius `PopSurface` track with a circular ink-outlined knob; knob `translateX` animates with `springs.pop`; `accessibilityRole="switch"`, `accessibilityState={{ checked: value }}`.
- `PopChip` — small `PopSurface` at `radii.pill`, `offset={shadow.pressed}`, `borderWidth={border.thin}`; selected state fills with `tone`, unselected fills `colors.surface`.
- `PopSheet` — full-screen scrim `rgba(20,20,20,0.55)`, a dismiss `Pressable` behind a centred `PopSurface` at `radii.lg` and `offset={shadow.hero}`, entering with `withSpring` scale from 0.9.
- `PopHeader` — row of back `PopIcon` (hidden when `onBack` is undefined), centred title at `typography.title`, right slot.
- `PopTabBar` — replaces `SketchTabBar`; a `PopSurface` bar pinned above the safe-area inset, one `Pressable` per route, selected tab's icon in `accentAt(index)` with a filled pill behind it.
- `AnimatedArt` — thin wrapper over `lottie-react-native`'s `LottieView`. Screens must import this, never `LottieView` directly, so the runtime can be swapped for Rive later without touching screens.

- [ ] **Step 7: Add the new exports alongside the old ones**

**Do not delete the `Sketch*` components yet.** Every unconverted screen still imports them; removing them here would break the build for the next eleven tasks. They are deleted in Task 17, after the last screen stops using them.

Append to `src/shared/ui/index.ts`, keeping the existing exports in place:

```ts
export { AnimatedArt } from './AnimatedArt';
export { PopButton, type PopTone } from './PopButton';
export { PopChip } from './PopChip';
export { PopHeader } from './PopHeader';
export { PopIcon, type PopIconName } from './PopIcon';
export { PopProgress } from './PopProgress';
export { PopSheet } from './PopSheet';
export { PopSurface } from './PopSurface';
export { PopTabBar } from './PopTabBar';
export { PopToggle } from './PopToggle';
```

- [ ] **Step 8: Point the tabs layout at the new bar**

In `src/app/(tabs)/_layout.tsx`, replace the `SketchTabBar` import and usage with `PopTabBar`, and rename the `explore` screen to `puzzles`:

```tsx
import { Tabs } from 'expo-router';

import { PopTabBar } from '@/shared/ui';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <PopTabBar {...props} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="puzzles" />
      <Tabs.Screen name="library" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
```

- [ ] **Step 9: Commit**

```bash
git add -A src/shared/ui src/app/\(tabs\)/_layout.tsx
git commit -m "feat(ui): add Chunky Pop component library, remove Sketch components"
```

---

# Milestone B — Real local data

Every task here is pure logic or SQLite and is fully unit-testable. This milestone is what makes "no fake numbers" achievable in Milestone D.

### Task 6: Settings repository

**Files:**
- Create: `src/data/local/settings-repository.ts`, `src/data/local/settings-repository.test.ts`
- Modify: `src/data/repositories.ts`, `src/data/local/database.ts`, `src/data/index.ts`

**Interfaces:**
- Produces: `interface AppSettings { sound: boolean; music: boolean; haptics: boolean }`; `interface SettingsRepository { get(): Promise<AppSettings>; set(patch: Partial<AppSettings>): Promise<AppSettings> }`; `SQLiteSettingsRepository`; `getSettingsRepository(): Promise<SQLiteSettingsRepository>`

- [ ] **Step 1: Write the failing test**

Create `src/data/local/settings-repository.test.ts`:

```ts
import { DEFAULT_SETTINGS, mergeSettings, parseSettingsRows } from './settings-repository';

describe('mergeSettings', () => {
  it('overlays a patch onto current values', () => {
    expect(mergeSettings({ sound: true, music: true, haptics: true }, { music: false })).toEqual({
      sound: true,
      music: false,
      haptics: true,
    });
  });

  it('ignores undefined patch entries rather than writing them as false', () => {
    expect(mergeSettings(DEFAULT_SETTINGS, { sound: undefined })).toEqual(DEFAULT_SETTINGS);
  });
});

describe('parseSettingsRows', () => {
  it('falls back to defaults for missing keys', () => {
    expect(parseSettingsRows([{ key: 'sound', value: '0' }])).toEqual({
      ...DEFAULT_SETTINGS,
      sound: false,
    });
  });

  it('ignores unknown keys left by an older build', () => {
    expect(parseSettingsRows([{ key: 'gravity', value: '1' }])).toEqual(DEFAULT_SETTINGS);
  });

  it('defaults every toggle to on', () => {
    expect(DEFAULT_SETTINGS).toEqual({ sound: true, music: true, haptics: true });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/data/local/settings-repository.test.ts`
Expected: FAIL — `Cannot find module './settings-repository'`

- [ ] **Step 3: Implement**

Create `src/data/local/settings-repository.ts` with a `settings` key/value table (`key TEXT PRIMARY KEY, value TEXT NOT NULL`), an `initialize()` matching the `SQLiteProgressRepository` pattern, and the three pure helpers under test exported alongside the class. Booleans persist as `'1'` / `'0'`.

```ts
import type { SQLiteDatabase } from 'expo-sqlite';

import type { AppSettings, SettingsRepository } from '../repositories';

export const DEFAULT_SETTINGS: AppSettings = { sound: true, music: true, haptics: true };

const KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof AppSettings)[];

export interface SettingRow {
  key: string;
  value: string;
}

/** Overlay a patch, ignoring keys explicitly set to `undefined`. */
export function mergeSettings(current: AppSettings, patch: Partial<AppSettings>): AppSettings {
  const next = { ...current };
  for (const key of KEYS) {
    const value = patch[key];
    if (value !== undefined) {
      next[key] = value;
    }
  }
  return next;
}

/** Rows → settings, tolerating missing and unknown keys from older builds. */
export function parseSettingsRows(rows: readonly SettingRow[]): AppSettings {
  const next = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    if ((KEYS as string[]).includes(row.key)) {
      next[row.key as keyof AppSettings] = row.value === '1';
    }
  }
  return next;
}

export class SQLiteSettingsRepository implements SettingsRepository {
  constructor(private readonly database: SQLiteDatabase) {}

  async initialize(): Promise<void> {
    await this.database.execAsync(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `);
  }

  async get(): Promise<AppSettings> {
    const rows = await this.database.getAllAsync<SettingRow>('SELECT key, value FROM settings');
    return parseSettingsRows(rows);
  }

  async set(patch: Partial<AppSettings>): Promise<AppSettings> {
    const next = mergeSettings(await this.get(), patch);
    for (const key of KEYS) {
      await this.database.runAsync(
        `INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        key,
        next[key] ? '1' : '0',
      );
    }
    return next;
  }
}
```

Add the `AppSettings` and `SettingsRepository` types to `src/data/repositories.ts`, register `initialize()` in `database.ts`'s `connect()`, add `getSettingsRepository()` beside the existing getters, and export the module from `src/data/index.ts`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/data/local/settings-repository.test.ts`
Expected: PASS, 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/data
git commit -m "feat(data): persist sound, music, and haptics settings"
```

---

### Task 7: Wallet ledger

**Files:**
- Create: `src/data/local/wallet-repository.ts`, `src/data/local/wallet-repository.test.ts`
- Modify: `src/data/repositories.ts`, `src/data/local/database.ts`, `src/data/index.ts`

**Interfaces:**
- Produces: `interface Wallet { coins: number; hints: number }`; `type LedgerReason = 'puzzle-complete' | 'daily-complete' | 'streak-bonus' | 'hint-spend' | 'hint-purchase' | 'coin-purchase' | 'starter-grant'`; `interface LedgerEntry { id: number; deltaCoins: number; deltaHints: number; reason: LedgerReason; ref: string | null; createdAt: string }`; `interface WalletRepository { balance(): Promise<Wallet>; record(entry: NewLedgerEntry): Promise<Wallet>; history(limit?: number): Promise<LedgerEntry[]> }`; pure helpers `sumLedger(entries): Wallet`, `coinsForCompletion(gridSize: GridSize): number`

The balance is always derived by summing the ledger — never stored in a mutable counter. This is what makes a Phase 2 server reconciliation possible without guessing which side is right.

- [ ] **Step 1: Write the failing test**

Create `src/data/local/wallet-repository.test.ts`:

```ts
import { coinsForCompletion, STARTER_GRANT, sumLedger } from './wallet-repository';

const entry = (deltaCoins: number, deltaHints: number) => ({
  id: 0,
  deltaCoins,
  deltaHints,
  reason: 'puzzle-complete' as const,
  ref: null,
  createdAt: '2026-07-26T00:00:00.000Z',
});

describe('sumLedger', () => {
  it('returns a zero balance for an empty ledger', () => {
    expect(sumLedger([])).toEqual({ coins: 0, hints: 0 });
  });

  it('sums credits and debits', () => {
    expect(sumLedger([entry(100, 3), entry(-30, -1)])).toEqual({ coins: 70, hints: 2 });
  });

  it('never reports a negative balance even if the ledger over-debits', () => {
    expect(sumLedger([entry(10, 0), entry(-50, -5)])).toEqual({ coins: 0, hints: 0 });
  });
});

describe('coinsForCompletion', () => {
  it('scales the reward with the piece count', () => {
    expect(coinsForCompletion(8)).toBeGreaterThan(coinsForCompletion(3));
  });

  it('always awards something', () => {
    expect(coinsForCompletion(3)).toBeGreaterThan(0);
  });

  it('returns whole coins', () => {
    for (const size of [3, 4, 5, 6, 7, 8, 9, 10] as const) {
      expect(Number.isInteger(coinsForCompletion(size))).toBe(true);
    }
  });
});

describe('STARTER_GRANT', () => {
  it('gives a new player enough hints to learn what they do', () => {
    expect(STARTER_GRANT.deltaHints).toBeGreaterThanOrEqual(3);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/data/local/wallet-repository.test.ts`
Expected: FAIL — `Cannot find module './wallet-repository'`

- [ ] **Step 3: Implement**

Create `src/data/local/wallet-repository.ts`. Table:

```sql
CREATE TABLE IF NOT EXISTS ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  delta_coins INTEGER NOT NULL,
  delta_hints INTEGER NOT NULL,
  reason TEXT NOT NULL,
  ref TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ledger_created_at_idx ON ledger(created_at DESC);
```

Pure helpers:

```ts
/** Balances clamp at zero: a corrupt or replayed debit must not owe the player. */
export function sumLedger(entries: readonly LedgerEntry[]): Wallet {
  let coins = 0;
  let hints = 0;
  for (const item of entries) {
    coins += item.deltaCoins;
    hints += item.deltaHints;
  }
  return { coins: Math.max(0, coins), hints: Math.max(0, hints) };
}

/** Reward scales with piece count so a 10x10 is worth more than a 3x3. */
export function coinsForCompletion(gridSize: GridSize): number {
  return 10 + gridSize * gridSize;
}

export const STARTER_GRANT = {
  deltaCoins: 100,
  deltaHints: 5,
  reason: 'starter-grant' as const,
  ref: null,
};
```

`initialize()` inserts `STARTER_GRANT` exactly once, guarded by `SELECT COUNT(*) FROM ledger WHERE reason = 'starter-grant'`.

Register in `database.ts`, add `getWalletRepository()`, export from the barrel.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/data/local/wallet-repository.test.ts`
Expected: PASS, 7 tests

- [ ] **Step 5: Commit**

```bash
git add src/data
git commit -m "feat(data): add append-only wallet ledger with derived balances"
```

---

### Task 8: Achievements derived from real progress

**Files:**
- Create: `src/data/local/achievements-repository.ts`, `src/data/local/achievements-repository.test.ts`
- Modify: `src/data/index.ts`

**Interfaces:**
- Consumes: `PuzzleProgressSummary` from `src/data/repositories.ts`
- Produces: `interface AchievementDefinition { key: string; title: string; description: string; goal: number; icon: string; tone: 'mint' | 'grape' | 'bubblegum' | 'sunshine' }`; `ACHIEVEMENTS: readonly AchievementDefinition[]`; `interface AchievementState extends AchievementDefinition { current: number; unlocked: boolean }`; `deriveAchievements(summaries: readonly PuzzleProgressSummary[]): AchievementState[]`

**Dependency direction:** `icon` is a plain `string` and `tone` is a semantic token name, not a hex value — the data layer must not import from `src/shared/ui` or depend on the palette. The achievements screen maps `tone` to a colour and casts `icon` to `PopIconName` at the render boundary.

This replaces the six hardcoded rows in `src/features/achievements/achievements-screen.tsx:16-23`. `deriveAchievements` is pure, so it is fully testable and has no repository dependency.

- [ ] **Step 1: Write the failing test**

Create `src/data/local/achievements-repository.test.ts`:

```ts
import type { PuzzleProgressSummary } from '../repositories';

import { ACHIEVEMENTS, deriveAchievements } from './achievements-repository';

const done = (puzzleId: string, gridSize: 3 | 8, elapsedMs: number): PuzzleProgressSummary => ({
  puzzleId,
  gridSize,
  status: 'completed',
  lockedPieces: gridSize * gridSize,
  totalPieces: gridSize * gridSize,
  elapsedMs,
  updatedAt: '2026-07-26T00:00:00.000Z',
});

describe('deriveAchievements', () => {
  it('reports zero progress for a new player', () => {
    for (const state of deriveAchievements([])) {
      expect(state.current).toBe(0);
      expect(state.unlocked).toBe(false);
    }
  });

  it('unlocks First Puzzle after one completion', () => {
    const first = deriveAchievements([done('a', 3, 1000)]).find((a) => a.key === 'first-puzzle');
    expect(first?.unlocked).toBe(true);
  });

  it('does not count an in-progress puzzle as complete', () => {
    const summaries: PuzzleProgressSummary[] = [
      { ...done('a', 3, 1000), status: 'in-progress', lockedPieces: 2 },
    ];
    const first = deriveAchievements(summaries).find((a) => a.key === 'first-puzzle');
    expect(first?.unlocked).toBe(false);
  });

  it('counts only hard boards toward the hard-worker goal', () => {
    const state = deriveAchievements([done('a', 3, 1000), done('b', 8, 1000)]).find(
      (a) => a.key === 'hard-worker',
    );
    expect(state?.current).toBe(1);
  });

  it('never reports progress above the goal', () => {
    const many = Array.from({ length: 200 }, (_, i) => done(`p${i}`, 3, 1000));
    for (const state of deriveAchievements(many)) {
      expect(state.current).toBeLessThanOrEqual(state.goal);
    }
  });

  it('returns one state per definition, in definition order', () => {
    expect(deriveAchievements([]).map((a) => a.key)).toEqual(ACHIEVEMENTS.map((a) => a.key));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/data/local/achievements-repository.test.ts`
Expected: FAIL — `Cannot find module './achievements-repository'`

- [ ] **Step 3: Implement**

Create `src/data/local/achievements-repository.ts`. Definitions carry a `measure` function so `deriveAchievements` stays a single loop:

```ts
interface Measured extends AchievementDefinition {
  measure: (completed: readonly PuzzleProgressSummary[]) => number;
}

const DEFINITIONS: readonly Measured[] = [
  {
    key: 'first-puzzle',
    title: 'First Puzzle',
    description: 'Complete your first puzzle',
    goal: 1,
    icon: 'check',
    tone: 'mint',
    measure: (completed) => completed.length,
  },
  {
    key: 'collector',
    title: 'Puzzle Collector',
    description: 'Complete 50 puzzles',
    goal: 50,
    icon: 'puzzle',
    tone: 'grape',
    measure: (completed) => completed.length,
  },
  {
    key: 'hard-worker',
    title: 'Hard Worker',
    description: 'Complete 10 boards of 8×8 or larger',
    goal: 10,
    icon: 'medal',
    tone: 'bubblegum',
    measure: (completed) => completed.filter((s) => s.gridSize >= 8).length,
  },
  {
    key: 'speed-master',
    title: 'Speed Master',
    description: 'Finish a puzzle in under 10 minutes',
    goal: 1,
    icon: 'sparkle',
    tone: 'sunshine',
    measure: (completed) => completed.filter((s) => s.elapsedMs < 10 * 60 * 1000).length,
  },
] as const;

export const ACHIEVEMENTS: readonly AchievementDefinition[] = DEFINITIONS;

export function deriveAchievements(
  summaries: readonly PuzzleProgressSummary[],
): AchievementState[] {
  const completed = summaries.filter((s) => s.status === 'completed');
  return DEFINITIONS.map(({ measure, ...definition }) => {
    const current = Math.min(measure(completed), definition.goal);
    return { ...definition, current, unlocked: current >= definition.goal };
  });
}
```

Note the deliberate change from the mock: "Perfectionist — use fewer than 3 hints" and "Daily Player — 7 days" are dropped for now because hint counts and daily history are not recorded per puzzle yet. Reintroduce them in Phase 3 when `daily_results` exists. Do not ship an achievement that cannot advance.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/data/local/achievements-repository.test.ts`
Expected: PASS, 6 tests

- [ ] **Step 5: Commit**

```bash
git add src/data
git commit -m "feat(data): derive achievements from real progress"
```

---

### Task 9: Deterministic daily puzzle

**Files:**
- Create: `src/data/daily.ts`, `src/data/daily.test.ts`
- Modify: `src/data/index.ts`

**Interfaces:**
- Produces: `dateKey(date: Date): string` (local-time `YYYY-MM-DD`); `pickDailyPuzzle<T extends { id: string }>(puzzles: readonly T[], key: string): T | null`; `streakFrom(playedKeys: readonly string[], today: string): number`

Uses the engine's existing seeded RNG (`src/game-engine/core/rng.ts`) so selection is deterministic and identical for every player on a given date — which is exactly what Phase 3's server rotation must reproduce.

- [ ] **Step 1: Write the failing test**

Create `src/data/daily.test.ts`:

```ts
import { dateKey, pickDailyPuzzle, streakFrom } from './daily';

const catalog = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

describe('dateKey', () => {
  it('formats as YYYY-MM-DD', () => {
    expect(dateKey(new Date(2026, 6, 26))).toBe('2026-07-26');
  });

  it('zero-pads single-digit months and days', () => {
    expect(dateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('uses local date parts, so late-evening play does not skip a day', () => {
    expect(dateKey(new Date(2026, 6, 26, 23, 59))).toBe('2026-07-26');
  });
});

describe('pickDailyPuzzle', () => {
  it('is stable for the same date', () => {
    expect(pickDailyPuzzle(catalog, '2026-07-26')).toEqual(pickDailyPuzzle(catalog, '2026-07-26'));
  });

  it('returns null for an empty catalog', () => {
    expect(pickDailyPuzzle([], '2026-07-26')).toBeNull();
  });

  it('varies across dates', () => {
    const picks = new Set(
      ['2026-07-26', '2026-07-27', '2026-07-28', '2026-07-29'].map(
        (key) => pickDailyPuzzle(catalog, key)?.id,
      ),
    );
    expect(picks.size).toBeGreaterThan(1);
  });
});

describe('streakFrom', () => {
  it('is zero with no history', () => {
    expect(streakFrom([], '2026-07-26')).toBe(0);
  });

  it('counts consecutive days ending today', () => {
    expect(streakFrom(['2026-07-24', '2026-07-25', '2026-07-26'], '2026-07-26')).toBe(3);
  });

  it('survives a gap only if the streak still reaches yesterday', () => {
    expect(streakFrom(['2026-07-25'], '2026-07-26')).toBe(1);
    expect(streakFrom(['2026-07-20'], '2026-07-26')).toBe(0);
  });

  it('ignores duplicate entries for one day', () => {
    expect(streakFrom(['2026-07-26', '2026-07-26'], '2026-07-26')).toBe(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/data/daily.test.ts`
Expected: FAIL — `Cannot find module './daily'`

- [ ] **Step 3: Implement**

Create `src/data/daily.ts`, reusing `createSeededRng` from `@/game-engine`:

```ts
import { createSeededRng } from '@/game-engine';

/** Local-time `YYYY-MM-DD`. Deliberately not UTC: the daily should roll over at
 *  the player's midnight, not Greenwich's. */
export function dateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function pickDailyPuzzle<T extends { id: string }>(
  puzzles: readonly T[],
  key: string,
): T | null {
  if (puzzles.length === 0) {
    return null;
  }
  const random = createSeededRng(`daily:${key}`);
  return puzzles[Math.floor(random() * puzzles.length)] ?? null;
}

/** Consecutive days ending today (or yesterday, if today is not yet played). */
export function streakFrom(playedKeys: readonly string[], today: string): number {
  const played = new Set(playedKeys);
  const cursor = new Date(`${today}T00:00:00`);
  if (!played.has(today)) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let streak = 0;
  while (played.has(dateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
```

Confirm `createSeededRng` is exported from `src/game-engine/index.ts`; if not, add it to that barrel.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/data/daily.test.ts`
Expected: PASS, 10 tests

- [ ] **Step 5: Commit**

```bash
git add src/data
git commit -m "feat(data): add deterministic daily puzzle selection and streaks"
```

---

# Milestone C — Board rework

### Task 10: Remove the answer reveal

**Files:**
- Modify: `src/features/game/puzzle-board.tsx:166-223`, `654`, `676-687`
- Modify: `src/features/game/board-fx.ts:39-42`

**Interfaces:**
- Consumes: nothing new
- Produces: `FloatingPiece` without the `solvedCenterCanvas` and `magnetRadius` props

- [ ] **Step 1: Delete the ghost component and its render site**

Remove `GhostTarget` (`puzzle-board.tsx:166-175`) in full, and its usage at line 654:

```tsx
{draggingPrepared ? <GhostTarget prepared={draggingPrepared} /> : null}
```

- [ ] **Step 2: Remove the magnet from FloatingPiece**

Replace the `useDerivedValue` body in `FloatingPiece` so the piece tracks the finger exactly:

```tsx
const transform = useDerivedValue(() => [
  { translateX: fx.value },
  { translateY: fy.value },
  { scale: boardScale * FX.liftScale },
  { translateX: -prepared.cx },
  { translateY: -prepared.cy },
]);
```

Delete the `solvedCenterCanvas` and `magnetRadius` props from the component and from its call site, and delete the now-unused `solvedCenterCanvas` memo (`puzzle-board.tsx:399-408`) and `magnetRadius` (line 395).

- [ ] **Step 3: Retune the placement threshold**

`placeFromTray` used `snapThreshold * FX.magnetRatio` so it matched the visible magnet. With no magnet, the honest threshold is the engine's own:

```tsx
const placeThreshold = snapThreshold;
```

Remove `magnetRatio` and `magnetPull` from the `FX` object in `board-fx.ts`.

- [ ] **Step 4: Verify the engine is untouched**

Run: `npm test`
Expected: PASS, 59 tests. Any failure here means the change leaked into `src/game-engine`.

- [ ] **Step 5: Verify on device**

Run: `npm run android`
Grab a piece. Expected: **no coloured silhouette appears anywhere on the board**, and the piece sits exactly under your finger with no drift toward its slot.

- [ ] **Step 6: Commit**

```bash
git add src/features/game/puzzle-board.tsx src/features/game/board-fx.ts
git commit -m "fix(game): stop revealing the target slot when a piece is grabbed"
```

---

### Task 11: Instant grab and free placement

**Files:**
- Modify: `src/features/game/puzzle-board.tsx:442-561` (the gesture memo), `368-373`, `645-673`

**Interfaces:**
- Consumes: `raisePiece`, `dropPiece`, `isWithinSnapDistance` from `@/game-engine` — already imported
- Produces: board renders three groups — locked pieces, loose board pieces, tray pieces

No engine changes are required: `LayoutMode = 'tray' | 'scatter'` already exists at `src/game-engine/core/layout.ts:30`, `dropPiece` accepts an arbitrary position, and `raisePiece` handles re-grabbing.

- [ ] **Step 1: Split unplaced pieces into loose and tray**

`PieceState.position` is a non-nullable `Point` (`src/game-engine/core/types.ts:51`), so "is this piece in the tray?" cannot be a null check. It does not need to be: `trayPositions` in `src/game-engine/core/layout.ts:55` places every tray piece at `y = boardSize.height + gap * 2` or lower, i.e. **strictly below the board**. So a piece's own stored position already tells us where it lives, and no engine change is needed.

Replace the memo at `puzzle-board.tsx:368-373`:

```tsx
const lockedPieces = useMemo(() => session.pieces.filter((p) => p.isLocked), [session.pieces]);

/**
 * The engine lays unplaced pieces out below the board (`layout.ts` tray rows),
 * so a y inside the board rect means the player has dropped this piece on the
 * board and it should stay there, re-grabbable, instead of returning to a slot.
 */
const isOnBoard = useCallback(
  (piece: PieceState) => piece.position.y < boardSize.height,
  [boardSize.height],
);

const loosePieces = useMemo(
  () => session.pieces.filter((p) => !p.isLocked && isOnBoard(p)),
  [session.pieces, isOnBoard],
);

const trayPieces = useMemo(
  () => session.pieces.filter((p) => !p.isLocked && !isOnBoard(p)),
  [session.pieces, isOnBoard],
);
```

Import `type PieceState` from `@/game-engine` alongside the existing type imports.

- [ ] **Step 2: Replace the gesture's activation logic**

In `onBegin`, hit-test immediately instead of waiting for movement. Set `mode.value = 1` and call `beginGrab` right away when the touch lands on a tray slot or a loose board piece; set `mode.value = 2` (tray scroll) only when the touch lands on empty tray space. Delete the 5px dead zone and the `dy < -6 || |dy| >= |dx|` direction gate in `onChange` entirely.

- [ ] **Step 3: Make a miss keep the piece on the board**

In `placeFromTray` (rename to `releasePiece`), replace the early return:

```tsx
if (!isWithinSnapDistance(position, solved, placeThreshold)) {
  // Out of range on the board: leave the piece exactly where it was released so
  // it can be nudged. Released over the tray, it returns to the tray instead.
  if (canvasY < boardZoneH) {
    onSessionChangeRef.current(dropPiece({ ...common, position, snapThreshold: 0 }));
  }
  return;
}
```

`snapThreshold: 0` records the drop position without locking. This is verified safe against the engine: `dropPiece` (`src/game-engine/core/session.ts:139`) locks only when `isWithinSnapDistance` returns true, and that helper computes `distanceBetween(...) <= threshold`. At a threshold of `0` it can only be true when the piece is already exactly at its solved position — in which case locking is the correct outcome anyway.

Do **not** pass a negative threshold: `isWithinSnapDistance` (`session.ts:45`) throws `RangeError('Snap threshold must be non-negative.')`.

- [ ] **Step 4: Render loose pieces**

Between the locked-pieces map and the tray group, add a group that draws each loose piece at its stored board position, using the same `PieceFill` + outline pattern as `BoardPiece` but with the accent outline used for unplaced pieces.

- [ ] **Step 5: Verify the engine is untouched**

Run: `npm test`
Expected: PASS, 59 tests

- [ ] **Step 6: Verify on device**

Run: `npm run android`
Expected: a piece lifts the instant you touch it, with no lag and no accidental tray scroll. A piece dropped on an empty part of the board stays there and can be picked up again. A piece dropped over the tray returns to the tray.

- [ ] **Step 7: Commit**

```bash
git add src/features/game/puzzle-board.tsx
git commit -m "feat(game): instant grab and free placement on the board"
```

---

### Task 12: Restore the camera

**Files:**
- Create: `src/features/game/use-board-camera.ts` *(recovered)*
- Modify: `src/features/game/puzzle-board.tsx`

- [ ] **Step 1: Recover the file rather than rewriting it**

```bash
git show 455f72c:src/features/game/use-board-camera.ts > src/features/game/use-board-camera.ts
```

It already implements pinch-to-zoom, one-finger pan, double-tap zoom, and clamping, entirely on the UI thread.

- [ ] **Step 2: Read it and adapt it to the fitted-board layout**

The version in `455f72c` scaled the whole world including the tray. Here the camera must apply to the **board zone only** — the tray strip stays pinned and unscaled. Clamp scale to 1×–3×.

- [ ] **Step 3: Compose the gestures**

```tsx
const gesture = useMemo(
  () => Gesture.Simultaneous(Gesture.Exclusive(camDoubleTap, pan), camPinch),
  [camDoubleTap, pan, camPinch],
);
```

Screen→board coordinate conversion in `releasePiece` must read the live camera scale and offset, not the static `boardScale`.

- [ ] **Step 4: Verify**

Run: `npm test` → 59 pass. `npm run typecheck` → clean.

Run: `npm run android`. Start a 10×10. Expected: pinch zooms the board and not the tray; panning does not pick up a piece; double-tap toggles zoom; pieces still drop accurately at every zoom level.

- [ ] **Step 5: Commit**

```bash
git add src/features/game/use-board-camera.ts src/features/game/puzzle-board.tsx
git commit -m "feat(game): restore pinch-zoom and pan camera for dense boards"
```

---

### Task 13: Audio, restrained juice, and neighbour jiggle

**Files:**
- Create: `src/features/game/board-audio.ts`
- Modify: `src/features/game/board-fx.ts`, `src/features/game/puzzle-board.tsx`
- Create: `scripts/generate-placeholder-audio.mjs`
- Add: `assets/audio/pickup.wav`, `snap.wav`, `complete.wav`, `tap.wav`, `ambient.wav`, `README.md`

**Interfaces:**
- Consumes: `getSettingsRepository()` (Task 6)
- Produces: `initBoardAudio(settings: AppSettings): Promise<void>`, `playSfx(name: 'pickup' | 'snap' | 'complete' | 'tap'): void`, `setMusicEnabled(on: boolean): void`, `setSfxEnabled(on: boolean): void`

- [ ] **Step 1: Generate placeholder tones**

Do **not** download audio. Write `scripts/generate-placeholder-audio.mjs` that synthesises five 16-bit mono 44.1kHz WAV files with no dependencies — a WAV header plus generated samples:

| File | Character |
| --- | --- |
| `pickup.wav` | 90ms, 660Hz sine, fast exponential decay |
| `snap.wav` | 140ms, 440→880Hz rising sine with a short noise transient |
| `complete.wav` | 700ms, arpeggio 523/659/784/1047Hz, each 175ms |
| `tap.wav` | 60ms, 880Hz sine, very fast decay |
| `ambient.wav` | 4s loop, two detuned sines at 220Hz and 220.5Hz, slow amplitude swell |

Apply a 5ms fade in and out to every clip so playback does not click. Write them to `assets/audio/` and add `assets/audio/README.md` recording that these are **generated placeholders, not final audio**, and naming the script that regenerates them.

Commit the script as well as the output — the files must be reproducible, not mystery binaries.

Use `.wav` throughout, not `.m4a`: it needs no encoder and is decodable by `expo-audio` on both platforms.

- [ ] **Step 2: Implement the audio module**

Use `expo-audio`'s player API per `https://docs.expo.dev/versions/v57.0.0/sdk/audio/`. Preload the four SFX players once at board mount. All calls are fire-and-forget and must never throw — a failed play must not interrupt a drag. Gate SFX on `settings.sound` and the loop on `settings.music`.

- [ ] **Step 3: Gate haptics on the new setting**

`impact()` and `success()` in `board-fx.ts` currently always fire. Add a module-level `hapticsEnabled` flag set from settings, checked before each call.

- [ ] **Step 4: Add the restrained juice**

In the `FX` object, add — and use — only these:

```ts
/** Rendered scale while a piece is lifted. */
liftScale: 1.08,
/** Max tilt in degrees while dragging, derived from pointer velocity. */
maxTiltDeg: 4,
/** Spring used when a piece settles after release. */
settle: { damping: 14, stiffness: 180 },
/** Neighbour wobble on lock. */
jiggleMs: 120,
jiggleAmplitude: 2,
```

No squash-and-stretch. Every value stays in this object so the feel is tunable from one file.

- [ ] **Step 5: Implement neighbour jiggle**

On lock, find the locked orthogonal neighbours of the placed piece by row/column from `prepared.geometry`, and run a `withSequence` of small `translateY` offsets over `FX.jiggleMs` on each.

- [ ] **Step 6: Verify**

Run: `npm test` → 59 pass.

Run: `npm run android`. Expected: pickup and snap sounds fire; toggling Sound off in the pause menu silences them and the setting survives an app restart; toggling Haptics off stops the vibration; neighbours wobble when a piece locks.

- [ ] **Step 7: Commit**

```bash
git add assets/audio src/features/game
git commit -m "feat(game): add board audio, settings-gated haptics, and neighbour jiggle"
```

---

### Task 14: Real hints and a live toolbar

**Files:**
- Modify: `src/features/game/game-screen.tsx:320-397` (toolbar and overlays)

**Interfaces:**
- Consumes: `getWalletRepository()` (Task 7), `PopSheet`, `PopButton`, `PopIcon`

- [ ] **Step 1: Replace the static hint overlay**

Delete the fixed string at `game-screen.tsx:371-373`. The Hint sheet offers:

| Hint | Cost | Behaviour |
| --- | --- | --- |
| Show me one | 1 hint | Picks an unplaced piece, flashes its tray slot and its home slot, and places it on tap |
| Edges | free | Existing `highlightEdges` toggle |
| Preview | free | Existing full-image overlay |

"Show me one" debits the wallet via `record({ deltaCoins: 0, deltaHints: -1, reason: 'hint-spend', ref: puzzleId })` **before** revealing. Disable the button and show "Get more in the Shop" when `hints === 0`.

- [ ] **Step 2: Fix the toolbar**

Replace the duplicate `Back` (`game-screen.tsx:321`) with **Shuffle tray**, which reorders `trayPieces` with a fresh seed. Show the live hint count on the Hint button.

- [ ] **Step 3: Wire the pause toggles**

Sound, Music, and a new Haptics toggle read and write `getSettingsRepository()` and call into `board-audio.ts`.

- [ ] **Step 4: Award coins on completion**

In the completion effect (`game-screen.tsx:179-196`), record `{ deltaCoins: coinsForCompletion(gridSize), deltaHints: 0, reason: 'puzzle-complete', ref: puzzleId }` once, guarded by the existing `handedOff` ref so a re-render cannot double-credit. Pass the earned amount to the results screen.

- [ ] **Step 5: Verify**

Run: `npm test`, `npm run typecheck`, `npm run lint` — all clean.

Run: `npm run android`. Expected: every button in the game screen and its overlays does something observable; the hint count decreases when spent and persists across a restart; completing a puzzle increases the coin balance shown on Home.

- [ ] **Step 6: Commit**

```bash
git add src/features/game/game-screen.tsx
git commit -m "feat(game): real hints, live toolbar, and completion rewards"
```

---

# Milestone D — Screens

### Task 15: The conversion pattern, proven on Home

**Files:**
- Modify: `src/features/home/home-screen.tsx`

Every remaining screen follows exactly this pattern. Convert Home first, review it, then apply the same recipe to the rest.

**The recipe**

| Old | New |
| --- | --- |
| `<PaperBackground>` | `<View style={{ flex: 1, backgroundColor: colors.paper }}>` |
| `<SketchFrame fill={x} radius={r} seed={n}>` | `<PopSurface fill={x} radius={r}>` — drop `seed` and `jitter` |
| `<SketchButton label variant="primary">` | `<PopButton label tone="grape">` |
| `variant="gold"` / `variant="plain"` | `tone="sunshine"` / `tone="surface"` |
| `<SketchIcon name="x" />` | `<PopIcon name="x" />` — remap names to the curated set |
| `<ScreenHeader title>` | `<PopHeader title onBack={router.back} />` |
| `<SketchToggle>` | `<PopToggle>` |
| Any hardcoded number | A value read from a repository |
| `colors.canvas` | `colors.paper` |
| `colors.primary` | `colors.grape` |
| `colors.accent` | `colors.tangerine` |
| `colors.gold` | `colors.sunshine` |
| `colors.sage` | `colors.mint` |
| `colors.rose` | `colors.bubblegum` |
| `fontWeight` in a text style | Remove — the family encodes weight |

Sections in a list get `fill={accentAt(index)}` so colour is deterministic and never repeats adjacently.

- [ ] **Step 1: Convert Home using the recipe**

- [ ] **Step 2: Verify no fake data remains**

Run: `npx grep -rn "9866\|Puzzle Master\|puzzlemaster@" src/features/home/` — expect no matches.

- [ ] **Step 3: Verify**

Run: `npm run typecheck` and `npm run lint` — clean for this file.
Run: `npm run android` — Home renders in the new theme with real progress values.

- [ ] **Step 4: Commit**

```bash
git add src/features/home/home-screen.tsx
git commit -m "feat(home): convert to Chunky Pop"
```

---

### Task 16: Convert the remaining screens

**Files:** one commit per screen, applying the Task 15 recipe.

- [ ] **Step 1: `src/features/puzzles/puzzles-screen.tsx`** — renamed from `explore/explore-screen.tsx`; also rename the route `src/app/(tabs)/explore.tsx` → `puzzles.tsx`. Make the five category chips real filters over `PuzzleDefinition`, and point "See all" at `pack/[packId]`. A category with no puzzles must not render as an empty tap target.
- [ ] **Step 2: `src/features/library/library-screen.tsx`** — add the Favourites and My Photos tabs; move photo import here.

  Favourites needs storage that does not exist yet. Add it first, following the Task 6 pattern exactly: a `favourites` table (`puzzle_id TEXT PRIMARY KEY NOT NULL, created_at TEXT NOT NULL`), a `FavouritesRepository` port in `src/data/repositories.ts` with `list(): Promise<string[]>`, `toggle(puzzleId: string): Promise<boolean>` returning the new state, and `isFavourite(puzzleId: string): Promise<boolean>`; register `initialize()` in `database.ts` and add `getFavouritesRepository()`. The existing Library tab type becomes `type Tab = 'progress' | 'completed' | 'favourites' | 'photos'`. Without this the Favourites tab would render permanently empty — which is exactly the kind of hollow surface Phase 1 exists to remove.
- [ ] **Step 3: `src/features/profile/profile-screen.tsx`** — replace the hardcoded name and email with a locally stored nickname (default "Player"); route Statistics and Settings to the real screens; remove the Help `Alert` or point it at a real destination.
- [ ] **Step 4: `src/features/achievements/achievements-screen.tsx`** — delete the `ACHIEVEMENTS` const at lines 16-23 and render `deriveAchievements()` from Task 8.
- [ ] **Step 5: `src/features/shop/shop-screen.tsx`** — real balance from the wallet; hint bundles purchasable with coins via `record()`. Coin packs and Remove Ads are real IAP in Phase 4 — until then, hide them rather than showing a dead "Coming soon" button.
- [ ] **Step 6: `src/features/daily/daily-screen.tsx`** — use `pickDailyPuzzle` and `streakFrom` from Task 9; mark played days on the calendar.
- [ ] **Step 7: `src/features/difficulty/difficulty-screen.tsx`** and **`src/features/results/results-screen.tsx`** — apply the recipe; Results additionally shows coins earned and a Lottie celebration via `AnimatedArt`.
- [ ] **Step 8: Create `src/features/settings/settings-screen.tsx`** + route — sound, music, haptics from Task 6; app version; licences.
- [ ] **Step 9: Create `src/features/statistics/statistics-screen.tsx`** + route — puzzles completed, total time, best time, favourite grid size, all from `listSummaries()`.
- [ ] **Step 10: Create `src/features/pack/pack-screen.tsx`** + route `src/app/pack/[packId].tsx` — group the bundled catalog into local packs.

---

### Task 17: Remove the scaffolding, then verify

- [ ] **Step 0: Delete the Sketch components and the legacy colour aliases**

Now that no screen imports them:

```bash
git rm src/shared/ui/SketchFrame.tsx src/shared/ui/SketchButton.tsx \
       src/shared/ui/SketchIcon.tsx src/shared/ui/SketchTabBar.tsx \
       src/shared/ui/SketchToggle.tsx src/shared/ui/PaperBackground.tsx \
       src/shared/ui/ScreenHeader.tsx
```

Remove their exports from `src/shared/ui/index.ts`, and delete the `legacyColors` block added in Task 2 along with its spread into `colors`.

Run: `npm run typecheck`
Expected: clean. Any error here names a screen that was never converted — convert it before continuing.

- [ ] **Step 1: Confirm no fake data survives anywhere**

```bash
grep -rn "9866\|Puzzle Master\|puzzlemaster@\|Coming soon\|Look for a corner piece" src/
```

Expected: no matches. Every hit is a Phase 1 failure.

- [ ] **Step 2: Confirm the Sketch theme is fully gone**

```bash
grep -rn "Sketch\|PaperBackground\|colors.canvas\|colors.sage\|colors.kraft" src/
```

Expected: no matches.

- [ ] **Step 3: Run every gate**

```bash
npm run typecheck && npm run lint && npm test && npm run format:check
```

Expected: typecheck clean, lint 0 problems, 59+ tests passing, formatting clean.

- [ ] **Step 4: Device acceptance pass**

Run `npm run android` and confirm each item by hand — none of these can be verified by a test run:

- [ ] Grabbing a piece reveals **no** silhouette at its destination
- [ ] A piece lifts the instant it is touched, with no dead zone
- [ ] A piece dropped on an empty board area stays there and can be re-grabbed
- [ ] Pinch-zoom and pan work on a 10×10; the tray does not scale
- [ ] Neighbouring pieces wobble when a piece locks
- [ ] Sound, Music, and Haptics toggles each have an audible or tactile effect, and survive a restart
- [ ] Spending a hint decrements the count and it persists across a restart
- [ ] Completing a puzzle increases the coin balance on Home
- [ ] Every button on every screen does something observable
- [ ] No screen shows a number that is not backed by a repository

- [ ] **Step 5: Commit and open the PR**

```bash
git add -A
git commit -m "feat: complete Chunky Pop Phase 1"
git push -u origin design/chunky-pop-v1
```

Confirm `design/sticker-scrapbook` still exists locally and was **not** pushed:

```bash
git branch --list design/sticker-scrapbook
git ls-remote --heads origin design/sticker-scrapbook
```

Expected: the first prints the branch, the second prints nothing.
