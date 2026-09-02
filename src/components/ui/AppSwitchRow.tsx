import React from 'react';
import { Pressable, StyleSheet, Switch, Text } from 'react-native';
import { colors, radius } from '@/theme';

interface SwitchProps {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}

export function AppSwitchRow({ label, value, onValueChange }: SwitchProps) {
  return (
    <Pressable style={styles.row} onPress={() => onValueChange(!value)}>
      <Text style={styles.label}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.borderStrong, true: colors.brand[400] }}
        thumbColor={value ? colors.brand[700] : colors.white}
      />
    </Pressable>
  );
}

export const Chip = React.memo(function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipOn]}>
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  label: { color: colors.textSecondary, fontWeight: '600', flex: 1, paddingRight: 12 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginRight: 8,
    marginBottom: 8,
  },
  chipOn: {
    backgroundColor: colors.brand[50],
    borderColor: colors.brand[600],
  },
  chipText: { color: colors.muted, fontWeight: '700', fontSize: 12 },
  chipTextOn: { color: colors.brand[800] },
});
