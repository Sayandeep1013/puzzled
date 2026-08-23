import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getWalletRepository } from '@/data';
import { radii, spacing, typography } from '@/shared/theme';
import { useTheme, useThemeControl } from '@/shared/theme-context';
import { createThemedStyles } from '@/shared/themed-styles';
import { THEMES, type Theme } from '@/shared/themes';
import { Art, PopButton, PopHeader, PopIcon, PopSurface, Text, ThemeGround } from '@/shared/ui';

/**
 * The theme store.
 *
 * Its own screen rather than a section inside Settings, which is where it
 * started and where nobody found it. A theme changes the whole app; burying it
 * under three audio toggles undersells it and makes it unfindable — it is
 * reachable from Profile and from the coin page now, which are the two places a
 * player goes looking for things to spend on.
 *
 * Every theme ships inside the app. "Unlock" is exactly that — nothing is
 * downloaded, so there is no network to fail and no partially-applied theme.
 */
export function ThemesScreen() {
  const theme = useTheme();
  const { setThemeId } = useThemeControl();
  const styles = useStyles();
  const router = useRouter();

  const [coins, setCoins] = useState<number | null>(null);
  /** Theme ids already paid for. A free theme is never in here — it needs no row. */
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const wallet = await getWalletRepository();
      const [balance, history] = await Promise.all([wallet.balance(), wallet.history()]);
      setCoins(balance.coins);
      setUnlocked(
        new Set(
          history
            .filter((entry) => entry.reason === 'theme-unlock' && entry.ref != null)
            .map((entry) => entry.ref as string),
        ),
      );
    } catch {
      // An unreadable wallet leaves the paid themes locked rather than handing
      // them out — the safe direction to fail in.
    }
  }, []);

  // On focus, so coins earned on the coin page are spendable the moment the
  // player comes back here.
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const onChoose = useCallback(
    (target: Theme) => {
      const owned = target.price === 0 || unlocked.has(target.id);
      if (busy) {
        return;
      }
      if (owned) {
        setThemeId(target.id);
        return;
      }
      if ((coins ?? 0) < target.price) {
        return;
      }
      setBusy(true);
      void (async () => {
        try {
          // `recordOnce` keyed on the theme, so a double tap cannot charge twice
          // and re-selecting one you already own is always free.
          await (
            await getWalletRepository()
          ).recordOnce({
            deltaCoins: -target.price,
            deltaHints: 0,
            reason: 'theme-unlock',
            ref: target.id,
          });
          setThemeId(target.id);
        } catch {
          // Best-effort; the refresh below shows whatever actually landed.
        }
        await refresh();
        setBusy(false);
      })();
    },
    [busy, coins, unlocked, setThemeId, refresh],
  );

  return (
    <View style={styles.root}>
      <ThemeGround />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <PopHeader
          title="Themes"
          onBack={() => router.back()}
          right={
            <View style={styles.balance}>
              <Art name="coin" size={22} />
              <Text style={styles.balanceText} numberOfLines={1}>
                {coins ?? '—'}
              </Text>
            </View>
          }
        />

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.lead}>
            A theme changes the whole app — every screen, every card, the board itself. Switch back
            whenever you like; unlocking is permanent.
          </Text>

          {THEMES.map((entry) => {
            const owned = entry.price === 0 || unlocked.has(entry.id);
            const active = entry.id === theme.id;
            const affordable = (coins ?? 0) >= entry.price;

            return (
              <PopSurface
                key={entry.id}
                fill={theme.colors.surface}
                radius={radii.lg}
                contentStyle={styles.card}
              >
                {/* A swatch built from the theme's own tokens — its ground, its
                    material, its card and the two inks that go on it — so the
                    choice is shown rather than described, and a new theme needs
                    no screenshot to advertise itself.

                    It used to be a card and one accent bar, which rendered the
                    same green in both rows: accents are deliberately *shared*
                    between themes so the art set still matches, which makes an
                    accent the one thing a swatch must not lead with. */}
                <View style={[styles.swatch, { backgroundColor: entry.backgrounds.default }]}>
                  {entry.groundTexture != null ? (
                    <Image
                      source={entry.groundTexture}
                      style={StyleSheet.absoluteFill}
                      resizeMode="cover"
                      accessible={false}
                    />
                  ) : null}
                  <View style={[styles.swatchCard, { backgroundColor: entry.colors.surface }]}>
                    <View
                      style={[styles.swatchLine, { backgroundColor: entry.colors.headingGreen }]}
                    />
                    <View
                      style={[
                        styles.swatchLine,
                        styles.swatchLineShort,
                        { backgroundColor: entry.colors.inkMuted },
                      ]}
                    />
                  </View>
                </View>

                <View style={styles.copy}>
                  <Text style={styles.name}>{entry.name}</Text>
                  {/* Always what the theme *is*. The active row used to say "In
                      use" here as well as on the control beside it, spending the
                      one line that could sell the theme on repeating the badge
                      two inches to its right. */}
                  <Text style={styles.description} numberOfLines={2}>
                    {owned || affordable
                      ? entry.description
                      : `Needs ${entry.price} coins — you have ${coins ?? 0}.`}
                  </Text>
                </View>

                {active ? (
                  // A state badge, not a dead button. `PopButton` draws its
                  // disabled state at 45% opacity, so on the one row the player
                  // has already chosen it read as broken rather than as done.
                  <View
                    style={styles.inUse}
                    accessible
                    accessibilityLabel={`${entry.name} theme, in use`}
                  >
                    <PopIcon name="check" size={18} color={theme.colors.grassDeep} />
                    <Text style={styles.inUseLabel} numberOfLines={1}>
                      In use
                    </Text>
                  </View>
                ) : (
                  <PopButton
                    label={owned ? 'Use' : String(entry.price)}
                    tone={owned ? 'grass' : 'honey'}
                    size="sm"
                    icon={owned ? undefined : <Art name="coin" size={18} />}
                    disabled={busy || (!owned && !affordable)}
                    accessibilityLabel={
                      owned
                        ? `Use the ${entry.name} theme`
                        : `Unlock the ${entry.name} theme for ${entry.price} coins`
                    }
                    onPress={() => onChoose(entry)}
                  />
                )}
              </PopSurface>
            );
          })}

          {/* Shaped like the rows above rather than as an illustration floating
              below them: centred under the list it sat in a band of empty ground
              that read as a layout fault, and it is in truth just the next row of
              the same list. */}
          <PopSurface fill={theme.colors.surface} radius={radii.lg} contentStyle={styles.card}>
            <View style={[styles.swatch, styles.swatchSoon]}>
              <Art name="sticker-book" size={44} />
            </View>
            <View style={styles.copy}>
              <Text style={styles.name}>More themes</Text>
              <Text style={styles.description} numberOfLines={2}>
                New looks are on the way — your coins keep until they land.
              </Text>
            </View>
          </PopSurface>
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
    lead: { ...typography.body, color: theme.colors.inkMuted },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
    },
    swatch: {
      width: 60,
      height: 60,
      borderRadius: radii.md,
      alignItems: 'center',
      justifyContent: 'center',
      // The material fills the tile edge to edge; without this the texture draws
      // square corners over the rounded ground beneath it.
      overflow: 'hidden',
    },
    swatchSoon: { backgroundColor: theme.colors.paper },
    swatchCard: {
      width: 38,
      height: 28,
      borderRadius: 8,
      paddingHorizontal: 5,
      justifyContent: 'center',
      gap: 4,
    },
    swatchLine: { height: 4, borderRadius: 2, alignSelf: 'stretch' },
    swatchLineShort: { width: 16, alignSelf: 'flex-start' },
    copy: { flex: 1, gap: 2 },
    name: { ...typography.heading, fontSize: 18, color: theme.colors.ink },
    description: { ...typography.caption, color: theme.colors.inkMuted },
    inUse: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radii.sm,
      backgroundColor: theme.colors.paper,
    },
    inUseLabel: {
      ...typography.heading,
      fontSize: 15,
      color: theme.colors.ink,
      paddingHorizontal: 2,
    },
  }),
);
