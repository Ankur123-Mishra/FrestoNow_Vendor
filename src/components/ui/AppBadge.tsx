import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '@/theme';
import { getStatusTone } from '@/utils/format';

interface Props {
  label: string;
  tone?: 'success' | 'warning' | 'danger' | 'info' | 'muted';
}

const toneMap = {
  success: { bg: colors.successSoft, fg: colors.success },
  warning: { bg: colors.warningSoft, fg: colors.warning },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  info: { bg: colors.infoSoft, fg: colors.info },
  muted: { bg: colors.bg, fg: colors.muted },
};

export function AppBadge({ label, tone }: Props) {
  const resolved = toneMap[tone || getStatusTone(label)];
  return (
    <View style={[styles.badge, { backgroundColor: resolved.bg }]}>
      <Text style={[styles.text, { color: resolved.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
