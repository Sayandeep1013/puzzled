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
   * Two splashes run back to back: the native one (a static bear, circle-masked
   * by Android and unfixable) and then `LoadingScreen` (the whole bear, bobbing).
   * They share a background colour, so the seam is invisible.
   */
  const [loading, setLoading] = useState(true);
  const finishLoading = useCallback(() => setLoading(false), []);

  useEffect(() => {
    // Hide on error too: a missing font must not leave the user on a splash forever.
    // Held until the fonts settle so nothing is seen in a fallback face and then
    // reflowed — the native splash covers the tree while it mounts underneath.
    if (fontsSettled) {
      void SplashScreen.hideAsync();
    }
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
          <Stack.Screen name="shop" />
          <Stack.Screen name="achievements" />
          <Stack.Screen name="statistics" />
          <Stack.Screen name="settings" />
          {/* Dev-only depth comparison; nothing links to it. `puzzled://depth-lab`. */}
          <Stack.Screen name="depth-lab" />
        </Stack>
        {/* Last child, so it overlays the navigator: the app mounts and warms up
            behind it rather than after it. Gated on the fonts so its wordmark is never
            drawn in a fallback face — until then the native splash is still up. */}
        {fontsSettled && loading ? <LoadingScreen onDone={finishLoading} /> : null}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
