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
