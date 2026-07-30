import { Tabs } from 'expo-router';
import { type ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type ArtName } from '@/shared/art';
import { colors, radii, spacing, typography } from '@/shared/theme';

import { Art } from './Art';
import { PopSurface } from './PopSurface';

// `Tabs.tabBar` receives BottomTabBarProps; derive it without a subpath import
// (expo-router does not re-export the type from its top-level entry point).
type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

/**
 * Tab identity, art, and the tint its label takes when focused.
 *
 * The route names are unchanged from Chunky Pop — this is a re-skin, so
 * Puzzles/Library keep their names rather than becoming the mockup's
 * Collection/Rewards, which would have meant new screens.
 *
 * `change-avatar` (the bear head) rather than `profile` (a generic orange
 * silhouette) for the Profile tab, matching the mockup and the rest of the set.
 */
const TABS: Record<string, { art: ArtName; label: string; tint: string }> = {
  index: { art: 'home', label: 'Home', tint: colors.headingGreen },
  puzzles: { art: 'category', label: 'Puzzles', tint: colors.sky },
  library: { art: 'album', label: 'Library', tint: colors.apricot },
  profile: { art: 'change-avatar', label: 'Profile', tint: colors.berry },
};

/**
 * Bar metrics, named so the styles below and `useTabBarSpace` read from the same
 * numbers. Previously each screen guessed, and every screen guessed zero — so
 * content scrolled underneath and the last row was unreadable.
 */
const ICON_SIZE = 26;
const LABEL_LINE = 14;
const ITEM_GAP = 2;
const BAR_HEIGHT = spacing.sm + ICON_SIZE + ITEM_GAP + LABEL_LINE + spacing.xs;

/**
 * Vertical space a screen under `(tabs)/` must reserve at the bottom of its
 * scroll content, because the bar floats over the scene rather than sitting
 * below it.
 *
 * The bar floats for a reason: in normal flow it rendered on the *navigator's*
 * background, so beneath it sat a strip of `paper` that did not match whichever
 * background the screen itself used — three stacked colours on Home, which read
 * as the bar being cut off. Floating lets each screen's own background run to
 * the bottom edge.
 *
 * Lives here because this component owns the metrics: change its padding and
 * every screen's reservation follows, instead of silently starting to clip.
 */
export function useTabBarSpace(): number {
  const insets = useSafeAreaInsets();
  return BAR_HEIGHT + Math.max(insets.bottom, spacing.md) + spacing.md;
}

/** Puzzle Journey bottom navigation, used as the custom `tabBar` for Tabs. */
export function PopTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}
      pointerEvents="box-none"
    >
      <PopSurface radius={radii.xl} elevation="raised" contentStyle={styles.bar}>
        {state.routes.map((route, index) => {
          const meta = TABS[route.name];
          if (!meta) {
            return null;
          }
          const focused = state.index === index;

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
              {/* The art is full-colour, so focus cannot be shown by tinting
                  it. A soft pill behind the icon carries the state instead, and
                  unfocused tabs dim their art rather than recolouring it. */}
              {focused ? <View style={styles.pill} /> : null}
              <Art name={meta.art} size={26} style={focused ? undefined : styles.dimmed} />
              <Text style={[styles.label, { color: focused ? meta.tint : colors.inkMuted }]}>
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
  // Absolute so the scene fills the whole screen behind it and each screen's own
  // background reaches the bottom edge. `pointerEvents: box-none` on the wrapper
  // keeps the padding around the pill from swallowing taps meant for content.
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.md,
  },
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
    top: -2,
    width: 44,
    height: 34,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(123, 193, 22, 0.18)',
  },
  dimmed: { opacity: 0.45 },
  label: {
    ...typography.caption,
    fontSize: 11,
    letterSpacing: 0.3,
  },
});
