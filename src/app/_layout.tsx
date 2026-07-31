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
    // Held until the fonts settle so the wordmark on `LoadingScreen` is never
    // drawn in a fallback face and then reflowed.
    if (fontsSettled) {
      void SplashScreen.hideAsync();
    }
  }, [fontsSettled]);

  if (!fontsSettled) {
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
        {/* Last child, so it overlays the navigator: the app mounts and warms up
            behind it rather than after it. */}
        {loading ? <LoadingScreen onDone={finishLoading} /> : null}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
