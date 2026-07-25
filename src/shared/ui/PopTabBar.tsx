import { Tabs } from 'expo-router';
import { type ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { accentAt, colors, radii, shadow, spacing, typography } from '@/shared/theme';

import { PopIcon, type PopIconName } from './PopIcon';
import { PopSurface } from './PopSurface';

// `Tabs.tabBar` receives BottomTabBarProps; derive it without a subpath import
// (expo-router does not re-export the type from its top-level entry point).
type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const TABS: Record<string, { icon: PopIconName; label: string }> = {
  index: { icon: 'home', label: 'Home' },
  puzzles: { icon: 'explore', label: 'Puzzles' },
  library: { icon: 'library', label: 'Library' },
  profile: { icon: 'profile', label: 'Profile' },
};

/** Chunky Pop bottom navigation used as the custom `tabBar` for expo-router Tabs. */
export function PopTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ paddingBottom: Math.max(insets.bottom, spacing.sm) }}>
      <PopSurface radius={radii.lg} offset={shadow.default} contentStyle={styles.bar}>
        {state.routes.map((route, index) => {
          const meta = TABS[route.name];
          if (!meta) {
            return null;
          }
          const focused = state.index === index;
          const accent = accentAt(index);

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
              {focused ? <View style={[styles.pill, { backgroundColor: `${accent}33` }]} /> : null}
              <PopIcon
                name={meta.icon}
                size={22}
                color={focused ? accent : colors.inkMuted}
                weight={focused ? 'fill' : 'regular'}
              />
              <Text style={[styles.label, { color: focused ? accent : colors.inkMuted }]}>
                {meta.label}
              </Text>
            </Pressable>
          );
        })}
      </PopSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  pill: {
    position: 'absolute',
    top: -4,
    width: 40,
    height: 40,
    borderRadius: radii.pill,
  },
  label: {
    ...typography.caption,
    fontSize: 11,
    letterSpacing: 0.5,
  },
});
