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
