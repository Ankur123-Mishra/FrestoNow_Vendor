import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { colors, radius } from '@/theme';
import { AppCard } from './AppCard';
import { moderateScale } from '@/utils/responsive';

interface Props {
  label: string;
  value: string;
  icon: LucideIcon;
  tint?: string;
}

export function StatCard({ label, value, icon: Icon, tint = colors.brand[600] }: Props) {
  return (
    <AppCard style={styles.card}>
      <View style={[styles.iconWrap, { backgroundColor: `${tint}18` }]}>
        <Icon size={18} color={tint} />
      </View>
      <Text style={styles.value} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.label}>{label}</Text>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, minWidth: 140, gap: 8 },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: moderateScale(20),
    fontWeight: '800',
    color: colors.text,
  },
  label: { color: colors.muted, fontSize: 12, fontWeight: '600' },
});
