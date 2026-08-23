import Constants from 'expo-constants';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// `DEFAULT_SETTINGS` is imported rather than restated: a local copy drifted the
// moment a non-boolean setting was added, and the compiler cannot keep one honest.
import {
  DEFAULT_SETTINGS,
  getSettingsRepository,
  getWalletRepository,
  type AppSettings,
} from '@/data';
import { radii, spacing, typography } from '@/shared/theme';
import { useTheme, useThemeControl } from '@/shared/theme-context';
import { createThemedStyles } from '@/shared/themed-styles';
import { THEMES, type Theme } from '@/shared/themes';
import { Art, PopButton, PopHeader, PopSurface, PopToggle, Text } from '@/shared/ui';

/** Only the boolean settings get a switch; the theme has its own picker. */
type ToggleKey = 'sound' | 'music' | 'haptics';

interface ToggleRow {
  key: ToggleKey;
  label: string;
  description: string;
}

const ROWS: ToggleRow[] = [
  { key: 'sound', label: 'Sound', description: 'Piece pickup, snap, and button taps' },
  { key: 'music', label: 'Music', description: 'Background music while you play' },
  { key: 'haptics', label: 'Haptics', description: 'Vibration feedback when a piece snaps' },
];

export function SettingsScreen() {
  const theme = useTheme();
  const { setThemeId } = useThemeControl();
  const styles = useStyles();
  const router = useRouter();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [coins, setCoins] = useState<number | null>(null);
  /** Theme ids already paid for. A free theme is never in here — it needs no row. */
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const refreshWallet = useCallback(async () => {
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
      // Best-effort: an unreadable wallet leaves the paid themes locked rather
      // than handing them out.
    }
  }, []);

  // On focus rather than on mount: coins earned on the coin page should be
  // spendable here the moment the player comes back, without a reload.
  useFocusEffect(
    useCallback(() => {
      void refreshWallet();
    }, [refreshWallet]),
  );

  const onChooseTheme = useCallback(
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
          // — and re-selecting a theme you already own is always free.
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
        await refreshWallet();
        setBusy(false);
      })();
    },
    [busy, coins, unlocked, setThemeId, refreshWallet],
  );

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const current = await (await getSettingsRepository()).get();
        if (active) setSettings(current);
      } catch {
        // Best-effort; the defaults already in state stand in for an unreadable database.
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const onToggle = (key: keyof AppSettings) => (next: boolean) => {
    setSettings((prev) => ({ ...prev, [key]: next }));
    void (async () => {
      try {
        await (await getSettingsRepository()).set({ [key]: next });
      } catch {
        // Best-effort persistence; the live toggle already reflects the tap.
      }
    })();
  };

  const version = Constants.expoConfig?.version;

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <PopHeader title="Settings" onBack={() => router.back()} />

        <ScrollView contentContainerStyle={styles.content}>
          <PopSurface fill={theme.colors.surface} radius={radii.lg}>
            <View style={styles.rows}>
              {ROWS.map((row, index) => (
                <View key={row.key}>
                  {index > 0 ? <View style={styles.divider} /> : null}
                  <View style={styles.row}>
                    <View style={styles.rowCopy}>
                      <Text style={styles.rowLabel}>{row.label}</Text>
                      <Text style={styles.rowDescription}>{row.description}</Text>
                    </View>
                    <PopToggle
                      value={settings[row.key]}
                      onChange={onToggle(row.key)}
                      accessibilityLabel={row.label}
                    />
                  </View>
                </View>
              ))}
            </View>
          </PopSurface>

          <Text style={styles.sectionTitle}>Theme</Text>
          {THEMES.map((entry) => {
            const owned = entry.price === 0 || unlocked.has(entry.id);
            const active = entry.id === theme.id;
            const affordable = (coins ?? 0) >= entry.price;
            return (
              <PopSurface
                key={entry.id}
                fill={theme.colors.surface}
                radius={radii.lg}
                contentStyle={styles.themeRow}
              >
                {/* A swatch of the theme's own ground and card, so the choice is
                    visible rather than described. */}
                <View style={[styles.swatch, { backgroundColor: entry.backgrounds.default }]}>
                  <View style={[styles.swatchCard, { backgroundColor: entry.colors.surface }]} />
                </View>
                <View style={styles.rowCopy}>
                  <Text style={styles.rowLabel}>{entry.name}</Text>
                  <Text style={styles.rowDescription}>
                    {active
                      ? 'In use'
                      : owned
                        ? entry.description
                        : affordable
                          ? entry.description
                          : `Needs ${entry.price} coins — you have ${coins ?? 0}.`}
                  </Text>
                </View>
                <PopButton
                  label={active ? 'In use' : owned ? 'Use' : `${entry.price}`}
                  tone={active ? 'surface' : owned ? 'grass' : 'honey'}
                  size="sm"
                  icon={!owned ? <Art name="coin" size={18} /> : undefined}
                  disabled={active || busy || (!owned && !affordable)}
                  accessibilityLabel={
                    active
                      ? `${entry.name} theme, in use`
                      : owned
                        ? `Use the ${entry.name} theme`
                        : `Unlock the ${entry.name} theme for ${entry.price} coins`
                  }
                  onPress={() => onChooseTheme(entry)}
                />
              </PopSurface>
            );
          })}

          {/* Three toggles leave a tall blank tail; the mascot closes it off. */}
          <View style={styles.footerArt}>
            <Art name="winking-duck" size={120} />
          </View>

          {version ? <Text style={styles.version}>Version {version}</Text> : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const useStyles = createThemedStyles((theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.colors.paper },
    safeArea: { flex: 1 },
    content: {
      padding: spacing.lg,
      gap: spacing.lg,
      width: '100%',
      maxWidth: 620,
      alignSelf: 'center',
    },
    rows: { padding: spacing.sm },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
    },
    rowCopy: { flex: 1, gap: 2 },
    rowLabel: { ...typography.heading, fontSize: 18, color: theme.colors.ink },
    rowDescription: { ...typography.caption, color: theme.colors.inkMuted },
    // A translucent warm rule rather than the page colour: the card is cream, so
    // painting the divider `paper` made it a visible green stripe.
    divider: {
      height: 1,
      backgroundColor: 'rgba(90, 62, 24, 0.14)',
      marginHorizontal: spacing.sm,
    },
    sectionTitle: {
      ...typography.heading,
      color: theme.colors.ink,
      marginTop: spacing.sm,
    },
    themeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
    },
    swatch: {
      width: 52,
      height: 52,
      borderRadius: radii.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    swatchCard: { width: 30, height: 22, borderRadius: 7 },
    footerArt: { alignItems: 'center', paddingTop: spacing.lg },
    version: { ...typography.caption, color: theme.colors.inkMuted, textAlign: 'center' },
  }),
);
