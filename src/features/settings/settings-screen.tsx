import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getSettingsRepository, type AppSettings } from '@/data';
import { colors, radii, spacing, typography } from '@/shared/theme';
import { Art, PopHeader, PopSurface, PopToggle, Text } from '@/shared/ui';

/** Matches `DEFAULT_SETTINGS` in the settings repository — all on until loaded. */
const DEFAULT_SETTINGS: AppSettings = { sound: true, music: true, haptics: true };

interface ToggleRow {
  key: keyof AppSettings;
  label: string;
  description: string;
}

const ROWS: ToggleRow[] = [
  { key: 'sound', label: 'Sound', description: 'Piece pickup, snap, and button taps' },
  { key: 'music', label: 'Music', description: 'Background music while you play' },
  { key: 'haptics', label: 'Haptics', description: 'Vibration feedback when a piece snaps' },
];

export function SettingsScreen() {
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
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <PopHeader title="Settings" onBack={() => router.back()} />

        <ScrollView contentContainerStyle={styles.content}>
          <PopSurface fill={colors.surface} radius={radii.lg}>
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
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
  rowLabel: { ...typography.heading, fontSize: 18, color: colors.ink },
  rowDescription: { ...typography.caption, color: colors.inkMuted },
  // A translucent warm rule rather than the page colour: the card is cream, so
  // painting the divider `paper` made it a visible green stripe.
  divider: {
    height: 1,
    backgroundColor: 'rgba(90, 62, 24, 0.14)',
    marginHorizontal: spacing.sm,
  },
  footerArt: { alignItems: 'center', paddingTop: spacing.lg },
  version: { ...typography.caption, color: colors.inkMuted, textAlign: 'center' },
});
