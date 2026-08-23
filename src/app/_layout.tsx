import { Fredoka_600SemiBold, Fredoka_700Bold, useFonts } from '@expo-google-fonts/fredoka';
import { Nunito_400Regular, Nunito_700Bold, Nunito_800ExtraBold } from '@expo-google-fonts/nunito';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors } from '@/shared/theme';
import { LoadingScreen } from '@/shared/ui';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [ready, error] = useFonts({
    Fredoka_600SemiBold,
    Fredoka_700Bold,
    Nunito_400Regular,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });
  const fontsSettled = ready || error != null;

  /**
   * The JS loading screen covers the app until it dissolves itself.
   *
   * Android always draws *something* before JS is alive, so the native phase cannot
   * be removed — only made indistinguishable from what replaces it. Dropping the
   * icon was tried and is not the answer: a second of flat blue followed by content
   * appearing reads as two screens exactly as a static bear did, and it broke the
   * Android build besides (the plugin writes the drawable reference into styles.xml
   * whether or not one is generated).
   *
   * So the native splash keeps the bear, and `LoadingScreen` opens with the same
   * bear at the same size on the same sky — see `src/shared/splash.ts`. Nothing
   * changes at the handoff; the animation starts after it.
   */
  const [loading, setLoading] = useState(true);
  const finishLoading = useCallback(() => setLoading(false), []);

  /**
   * Whether the native splash window is actually gone.
   *
   * `LoadingScreen` mounts before this — deliberately, so the app warms up
   * underneath — which means it renders, and *animates*, while still completely
   * hidden behind the native splash. Its entrance was therefore over before
   * anyone could see it: measured on device, the native bear sat at 149dp and
   * the very first visible loading-screen frame, 30ms later, was already at
   * 179.8dp and decaying. The bear appeared to jump, which is precisely the
   * seam the entrance exists to remove.
   *
   * So the reveal is what the animation waits on, not the mount.
   */
  const [splashHidden, setSplashHidden] = useState(false);

  useEffect(() => {
    // Hide on error too: a missing font must not leave the user on a splash forever.
    // Held until the fonts settle so nothing is seen in a fallback face and then
    // reflowed — the native splash covers the tree while it mounts underneath.
    if (!fontsSettled) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        await SplashScreen.hideAsync();
      } catch {
        // Already hidden, or unavailable. Either way the overlay must proceed —
        // never leave the launch animation waiting on a promise that failed.
      }
      if (!cancelled) {
        setSplashHidden(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fontsSettled]);

  /*
   * The navigator mounts immediately, even before the fonts settle.
   *
   * This used to `return null` until they did, which meant the router's tree did not
   * exist for the first few hundred milliseconds. expo-router resolves the initial deep
   * link asynchronously (`fork/useLinking.native.js`), and when the app is opened *via*
   * a link — a `puzzled://` deep link, or the dev client handing one over — that promise
   * could resolve before there was anything mounted to receive it, producing "Can't
   * perform a React state update on a component that hasn't mounted yet".
   *
   * Nothing is visible early regardless, because the native splash stays up until the
   * fonts settle. Mounting now instead of later also means the database opens and the
   * first screen builds while the splash is still showing, rather than afterwards.
   */
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
          <Stack.Screen name="coins" />
          <Stack.Screen name="achievements" />
          <Stack.Screen name="statistics" />
          <Stack.Screen name="settings" />
          {/* Dev-only depth comparison; nothing links to it. `puzzled://depth-lab`. */}
          <Stack.Screen name="depth-lab" />
        </Stack>
        {/* Last child, so it overlays the navigator: the app mounts and warms up
            behind it rather than after it. Gated on the fonts so its wordmark is never
            drawn in a fallback face — until then the native splash is still up. */}
        {fontsSettled && loading ? (
          <LoadingScreen onDone={finishLoading} revealed={splashHidden} />
        ) : null}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
