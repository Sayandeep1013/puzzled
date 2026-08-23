import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// `DEFAULT_SETTINGS` is imported rather than restated: a local copy drifted the
// moment a non-boolean setting was added, and the compiler cannot keep one honest.
import { DEFAULT_SETTINGS, getSettingsRepository, type AppSettings } from '@/data';
import { radii, spacing, typography } from '@/shared/theme';
import { useTheme } from '@/shared/theme-context';
import { createThemedStyles } from '@/shared/themed-styles';
import { Art, PopHeader, PopIcon, PopSurface, PopToggle, Text, ThemeGround } from '@/shared/ui';

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
  const styles = useStyles();
  const router = useRouter();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
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
      <ThemeGround />
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

          {/* A link, not the picker. A theme changes the whole app; running that
              from inside a list of audio toggles both undersold it and hid it —
              it has its own screen now, reachable from here and from Profile. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Themes"
            onPress={() => router.push('/themes')}
          >
            <PopSurface fill={theme.colors.surface} radius={radii.lg} contentStyle={styles.linkRow}>
              <Art name="sticker-book" size={34} />
              <View style={styles.rowCopy}>
                <Text style={styles.rowLabel}>Themes</Text>
                <Text style={styles.rowDescription}>Currently using {theme.name}</Text>
              </View>
              <PopIcon name="chevron" size={20} color={theme.colors.inkMuted} />
            </PopSurface>
          </Pressable>

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
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.xl,
      gap: spacing.md,
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
    linkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
    },
    footerArt: { alignItems: 'center', paddingTop: spacing.lg },
    version: { ...typography.caption, color: theme.colors.inkMuted, textAlign: 'center' },
  }),
);
