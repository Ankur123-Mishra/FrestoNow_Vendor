import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme';

export function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 8,
  },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
});
