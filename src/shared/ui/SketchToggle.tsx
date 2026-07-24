import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, typography } from '@/shared/theme';

/** A small hand-drawn on/off switch for settings rows. */
export function SketchToggle({
  value,
  onChange,
  accessibilityLabel,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={accessibilityLabel}
      onPress={() => onChange(!value)}
      style={[styles.track, { backgroundColor: value ? colors.sage : colors.kraft }]}
    >
      <Text style={[styles.text, value ? styles.on : styles.off]}>{value ? 'ON' : 'OFF'}</Text>
      <View style={[styles.knob, value ? styles.knobOn : styles.knobOff]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 62,
    height: 30,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.line,
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  text: { ...typography.label, fontSize: 10, position: 'absolute' },
  on: { left: 9, color: colors.inkSoft },
  off: { right: 9, color: colors.inkMuted },
  knob: {
    width: 20,
    height: 20,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.surfaceStrong,
  },
  knobOn: { alignSelf: 'flex-end' },
  knobOff: { alignSelf: 'flex-start' },
});
