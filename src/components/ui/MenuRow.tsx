import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { colors, radius } from '@/theme';

interface Props {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  danger?: boolean;
}

export function MenuRow({ icon: Icon, title, subtitle, onPress, danger }: Props) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <View style={[styles.icon, danger && styles.iconDanger]}>
        <Icon size={18} color={danger ? colors.danger : colors.brand[700]} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.title, danger && { color: colors.danger }]}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <ChevronRight size={18} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.brand[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconDanger: { backgroundColor: colors.dangerSoft },
  copy: { flex: 1 },
  title: { fontWeight: '700', color: colors.text, fontSize: 15 },
  subtitle: { color: colors.muted, fontSize: 12, marginTop: 2 },
});
