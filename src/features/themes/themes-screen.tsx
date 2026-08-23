import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getWalletRepository } from '@/data';
import { radii, spacing, typography } from '@/shared/theme';
import { useTheme, useThemeControl } from '@/shared/theme-context';
import { createThemedStyles } from '@/shared/themed-styles';
import { THEMES, type Theme } from '@/shared/themes';
import { Art, PopButton, PopHeader, PopSurface, Text, ThemeGround } from '@/shared/ui';

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
                {/* A swatch built from the theme's own tokens, so the choice is
                    shown rather than described — and so a new theme needs no
                    screenshot to advertise itself. */}
                <View style={[styles.swatch, { backgroundColor: entry.backgrounds.default }]}>
                  <View style={[styles.swatchCard, { backgroundColor: entry.colors.surface }]} />
                  <View style={[styles.swatchDot, { backgroundColor: entry.colors.grass }]} />
                </View>

                <View style={styles.copy}>
                  <Text style={styles.name}>{entry.name}</Text>
                  <Text style={styles.description}>
                    {active
                      ? 'In use'
                      : owned || affordable
                        ? entry.description
                        : `Needs ${entry.price} coins — you have ${coins ?? 0}.`}
                  </Text>
                </View>

                <PopButton
                  label={active ? 'In use' : owned ? 'Use' : String(entry.price)}
                  tone={active ? 'surface' : owned ? 'grass' : 'honey'}
                  size="sm"
                  icon={owned ? undefined : <Art name="coin" size={18} />}
                  disabled={active || busy || (!owned && !affordable)}
                  accessibilityLabel={
                    active
                      ? `${entry.name} theme, in use`
                      : owned
                        ? `Use the ${entry.name} theme`
                        : `Unlock the ${entry.name} theme for ${entry.price} coins`
                  }
                  onPress={() => onChoose(entry)}
                />
              </PopSurface>
            );
          })}

          <View style={styles.footerArt}>
            <Art name="sticker-book" size={120} />
            <Text style={styles.footerNote}>More themes are on the way.</Text>
          </View>
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
      gap: 4,
    },
    swatchCard: { width: 34, height: 20, borderRadius: 6 },
    swatchDot: { width: 20, height: 7, borderRadius: 4 },
    copy: { flex: 1, gap: 2 },
    name: { ...typography.heading, fontSize: 18, color: theme.colors.ink },
    description: { ...typography.caption, color: theme.colors.inkMuted },
    footerArt: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.xl },
    footerNote: { ...typography.caption, color: theme.colors.inkMuted, textAlign: 'center' },
  }),
);
