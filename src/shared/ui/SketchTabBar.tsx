import { Tabs } from 'expo-router';
import { type ComponentProps } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/shared/theme';
import { SketchIcon, type IconName } from './SketchIcon';

// `Tabs.tabBar` receives BottomTabBarProps; derive it without a subpath import.
type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const TABS: Record<string, { icon: IconName; label: string }> = {
  index: { icon: 'home', label: 'Home' },
  explore: { icon: 'explore', label: 'Explore' },
  library: { icon: 'library', label: 'Library' },
  profile: { icon: 'profile', label: 'Profile' },
};

/** Hand-drawn bottom navigation used as the custom `tabBar` for expo-router Tabs. */
export function SketchTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      {state.routes.map((route, index) => {
        const meta = TABS[route.name];
        if (!meta) {
          return null;
        }
        const focused = state.index === index;
        const tint = focused ? colors.primary : colors.inkMuted;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={meta.label}
            onPress={onPress}
            style={styles.item}
          >
            <SketchIcon name={meta.icon} size={26} color={tint} strokeWidth={focused ? 2.4 : 2} />
            <Text style={[styles.label, { color: tint }]}>{meta.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.sm,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  label: {
    ...typography.caption,
    fontSize: 11,
    letterSpacing: 0.5,
  },
});
