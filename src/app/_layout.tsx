import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors } from '@/shared/theme';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            contentStyle: { backgroundColor: colors.canvas },
            headerShown: false,
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="difficulty/[puzzleId]" />
          <Stack.Screen name="game/[puzzleId]" />
          <Stack.Screen name="results/[puzzleId]" />
          <Stack.Screen name="daily" />
          <Stack.Screen name="shop" />
          <Stack.Screen name="achievements" />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
