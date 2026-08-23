import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { LayoutChangeEvent, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Line } from 'react-native-svg';

import { dateKey, getCompletionsRepository, getWalletRepository, listCatalog } from '@/data';
import { radii, spacing, typography } from '@/shared/theme';
import { useTheme } from '@/shared/theme-context';
import { createThemedStyles } from '@/shared/themed-styles';
import { Art, PopButton, PopHeader, PopSurface, Text } from '@/shared/ui';

import {
  TREASURE_STOPS,
  treasureProgress,
  treasureRewardForStop,
  type TreasureProgress,
} from './treasure';

/**
 * The daily treasure hunt: a seven-stop map you walk by finishing the day's
 * challenge.
 *
 * The map is drawn rather than illustrated — the trail is SVG and the stops are
 * views laid over it — so it re-colours with the theme and needs no art of its
 * own beyond the chest. That matters more than it sounds: a painted map would
 * have to be redrawn for every theme, and would be the one screen that quietly
 * stayed in the meadow's palette.
 */

/** Stop positions in the map's own coordinate space, bottom-left to top-right. */
const MAP_W = 300;
const MAP_H = 380;
const NODES = [
  { x: 44, y: 338 },
  { x: 150, y: 296 },
  { x: 254, y: 250 },
  { x: 150, y: 200 },
  { x: 48, y: 152 },
  { x: 152, y: 104 },
  { x: 250, y: 52 },
];

/** Diameter of a stop marker, in points. */
const NODE = 46;

interface HuntData extends TreasureProgress {
  coins: number | null;
}

const EMPTY: HuntData = { streak: 0, stop: 0, doneToday: false, completedDays: [], coins: null };

async function loadHunt(todayKey: string): Promise<HuntData> {
  const { bundled, user } = await listCatalog();
  const pool = [...bundled, ...user];

  let completions: Awaited<
    ReturnType<Awaited<ReturnType<typeof getCompletionsRepository>>['list']>
  > = [];
  try {
    completions = await (await getCompletionsRepository()).list();
  } catch {
    // An unreadable log means an empty map, not a broken screen.
  }

  let coins: number | null = null;
  try {
    coins = (await (await getWalletRepository()).balance()).coins;
  } catch {
    // Same contract as everywhere else: no balance beats a wrong one.
  }

  return { ...treasureProgress(pool, completions, todayKey), coins };
}

export function TreasureScreen() {
  const theme = useTheme();
  const styles = useStyles();
  const router = useRouter();

  const [data, setData] = useState<HuntData>(EMPTY);
  const [today, setToday] = useState(() => dateKey(new Date()));
  /** Measured map width, so stops can be placed against the real size. */
  const [mapWidth, setMapWidth] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const now = dateKey(new Date());
      if (now !== today) {
        // Crossing midnight with the app open would otherwise leave the map on
        // yesterday's stop and refuse today's reward.
        setToday(now);
        return () => {
          active = false;
        };
      }
      loadHunt(today).then((next) => {
        if (!active) {
          return;
        }
        setData(next);
        if (next.doneToday && next.stop > 0) {
          // Paid on sight rather than claimed: there is nothing to decide, and
          // `recordOnce` keyed on the day makes returning to this screen
          // harmless. A player who never opens it is paid the next time they do.
          void (async () => {
            try {
              await (
                await getWalletRepository()
              ).recordOnce({
                deltaCoins: treasureRewardForStop(next.stop),
                deltaHints: 0,
                reason: 'treasure-stop',
                ref: today,
              });
            } catch {
              // Best-effort; the next visit tries again.
            }
          })();
        }
      });
      return () => {
        active = false;
      };
    }, [today]),
  );

  const mapHeight = mapWidth * (MAP_H / MAP_W);
  const onMapLayout = useCallback((event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    setMapWidth((current) => (Math.abs(current - width) < 1 ? current : width));
  }, []);

  const scale = mapWidth / MAP_W;
  const nextReward = treasureRewardForStop(
    data.stop >= TREASURE_STOPS ? 1 : Math.max(1, data.stop + 1),
  );

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <PopHeader
          title="Treasure Hunt"
          onBack={() => router.back()}
          right={
            <View style={styles.balance}>
              <Art name="coin" size={22} />
              <Text style={styles.balanceText} numberOfLines={1}>
                {data.coins ?? '—'}
              </Text>
            </View>
          }
        />

        <ScrollView contentContainerStyle={styles.content}>
          <PopSurface fill={theme.colors.surface} radius={radii.lg} contentStyle={styles.mapCard}>
            <View style={styles.mapHead}>
              <Text style={styles.mapTitle}>
                {data.streak === 0
                  ? 'Start the trail'
                  : `Day ${data.streak} — stop ${data.stop} of ${TREASURE_STOPS}`}
              </Text>
              <Text style={styles.mapMeta}>
                {data.doneToday
                  ? `Today’s stop paid ${treasureRewardForStop(data.stop)} coins. Next one is ${nextReward}.`
                  : `Finish today’s challenge to reach the next stop — ${nextReward} coins.`}
              </Text>
            </View>

            <View style={[styles.map, { height: mapHeight }]} onLayout={onMapLayout}>
              {mapWidth > 0 ? (
                <>
                  {/* The trail, one segment per pair so the walked part can be
                      coloured without splitting a single path. */}
                  <Svg width={mapWidth} height={mapHeight} style={StyleSheet.absoluteFill}>
                    {NODES.slice(0, -1).map((from, index) => {
                      const to = NODES[index + 1];
                      const walked = index + 2 <= data.stop;
                      return (
                        <Line
                          key={index}
                          x1={from.x * scale}
                          y1={from.y * scale}
                          x2={to.x * scale}
                          y2={to.y * scale}
                          stroke={walked ? theme.colors.grass : theme.colors.locked}
                          strokeWidth={6}
                          strokeLinecap="round"
                          // A dotted trail, the way a map draws a route.
                          strokeDasharray="1 16"
                          opacity={walked ? 1 : 0.55}
                        />
                      );
                    })}
                  </Svg>

                  {NODES.map((node, index) => {
                    const stop = index + 1;
                    const reached = stop <= data.stop;
                    const current = stop === data.stop;
                    const isChest = stop === TREASURE_STOPS;
                    return (
                      <View
                        key={stop}
                        accessible
                        accessibilityRole="text"
                        accessibilityLabel={
                          reached
                            ? `Stop ${stop}, reached`
                            : `Stop ${stop}, ${treasureRewardForStop(stop)} coins`
                        }
                        style={[
                          styles.node,
                          {
                            left: node.x * scale - NODE / 2,
                            top: node.y * scale - NODE / 2,
                            backgroundColor: reached
                              ? theme.colors.grass
                              : isChest
                                ? theme.colors.honey
                                : theme.colors.surface,
                          },
                          current && styles.nodeCurrent,
                        ]}
                      >
                        {isChest ? (
                          <Art name={reached ? 'chest-open' : 'chest'} size={30} />
                        ) : reached ? (
                          <Art name="coin-check" size={24} />
                        ) : (
                          <Text style={styles.nodeLabel}>{treasureRewardForStop(stop)}</Text>
                        )}
                      </View>
                    );
                  })}
                </>
              ) : null}
            </View>
          </PopSurface>

          <PopButton
            label={data.doneToday ? 'Play another puzzle' : 'Play today’s challenge'}
            tone="grass"
            icon={<Art name={data.doneToday ? 'puzzle-quad' : 'play'} size={24} />}
            onPress={() => router.push(data.doneToday ? '/puzzles' : '/daily')}
          />

          <Text style={styles.footnote}>
            One stop a day. Miss a day and the trail starts again — your coins stay.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const useStyles = createThemedStyles((theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.colors.paper },
    safe: { flex: 1 },
    balance: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    balanceText: {
      ...typography.heading,
      fontSize: 17,
      color: theme.colors.ink,
      paddingHorizontal: 2,
    },
    content: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.xl,
      gap: spacing.md,
      width: '100%',
      maxWidth: 620,
      alignSelf: 'center',
    },
    mapCard: { padding: spacing.md, gap: spacing.md },
    mapHead: { gap: 2 },
    mapTitle: { ...typography.heading, fontSize: 18, color: theme.colors.ink },
    mapMeta: { ...typography.caption, color: theme.colors.inkMuted },
    map: { width: '100%' },
    node: {
      position: 'absolute',
      width: NODE,
      height: NODE,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      // The trail runs underneath, so every stop needs to sit on something.
      borderWidth: 3,
      borderColor: theme.colors.surface,
    },
    nodeCurrent: {
      borderColor: theme.colors.honey,
      // Scaled rather than shadowed: a shadow on a themed ground reads as smudge.
      transform: [{ scale: 1.12 }],
    },
    nodeLabel: { ...typography.caption, fontSize: 12, color: theme.colors.inkMuted },
    footnote: { ...typography.caption, color: theme.colors.inkMuted, textAlign: 'center' },
  }),
);
