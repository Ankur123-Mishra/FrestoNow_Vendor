import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { BarChart3 } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { AppCard } from '@/components/ui/AppCard';
import { AppEmpty } from '@/components/ui/AppEmpty';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppLoader } from '@/components/ui/AppLoader';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { StatCard } from '@/components/ui/StatCard';
import { vendorService } from '@/api/services';
import { getModuleMeta } from '@/config/modules';
import { getActiveModule, useModuleStore } from '@/store/moduleStore';
import { useToastStore } from '@/store/toastStore';
import { colors, radius } from '@/theme';
import { getErrorMessage, mapDashboardStats } from '@/utils/apiHelpers';
import { formatCurrency, formatDate, pickString, titleCaseStatus } from '@/utils/format';
import type { DashboardStats } from '@/types';

function isoDay(offsetDays: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString();
}

const PRESETS = [
  { label: 'Today', from: () => isoDay(0), to: () => new Date().toISOString() },
  { label: '7 days', from: () => isoDay(-6), to: () => new Date().toISOString() },
  { label: '30 days', from: () => isoDay(-29), to: () => new Date().toISOString() },
];

export function ReportsScreen() {
  const showToast = useToastStore(s => s.show);
  const activeModule = useModuleStore(s => s.activeModule);
  const meta = getModuleMeta(activeModule);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [preset, setPreset] = useState(1);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  const load = useCallback(async () => {
    try {
      const range = {
        from: PRESETS[preset].from(),
        to: PRESETS[preset].to(),
      };
      const res = await vendorService.getReports(getActiveModule(), range);
      setStats(mapDashboardStats(res.data));
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not load reports'), 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [preset, showToast]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  if (loading && !stats) {
    return (
      <Screen>
        <AppLoader label="Loading reports" />
      </Screen>
    );
  }

  const totals = stats?.totals;

  return (
    <Screen>
      <AppHeader title="Reports" subtitle={`${meta.label} sales overview`} showBack />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }>
        <View style={styles.presets}>
          {PRESETS.map((item, index) => (
            <Pressable
              key={item.label}
              onPress={() => setPreset(index)}
              style={[styles.preset, preset === index && styles.presetOn]}>
              <Text style={[styles.presetText, preset === index && styles.presetTextOn]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.grid}>
          <StatCard label="Orders" value={String(totals?.orders ?? 0)} icon={BarChart3} />
          <StatCard
            label="Revenue"
            value={formatCurrency(totals?.revenue)}
            icon={BarChart3}
            tint={colors.brand[700]}
          />
          <StatCard
            label="Completed"
            value={String(totals?.completed ?? 0)}
            icon={BarChart3}
            tint={colors.success}
          />
          <StatCard
            label="Cancel rate"
            value={`${totals?.cancelRate ?? 0}%`}
            icon={BarChart3}
            tint={colors.warning}
          />
        </View>

        <SectionTitle title="By status" />
        <AppCard style={styles.card}>
          {stats?.byStatus?.length ? (
            stats.byStatus.map((item, index) => (
              <View
                key={`${item.status}-${index}`}
                style={[styles.row, index < stats.byStatus.length - 1 && styles.divider]}>
                <Text style={styles.rowLabel}>{titleCaseStatus(item.status) || 'Unknown'}</Text>
                <Text style={styles.rowValue}>{item.count}</Text>
              </View>
            ))
          ) : (
            <AppEmpty title="No status data" subtitle="Try another date range." />
          )}
        </AppCard>

        <SectionTitle title="By channel" />
        <AppCard style={styles.card}>
          {stats?.byChannel?.length ? (
            stats.byChannel.map((item, index) => (
              <View
                key={`${item.channel}-${index}`}
                style={[styles.row, index < stats.byChannel.length - 1 && styles.divider]}>
                <Text style={styles.rowLabel}>{pickString(item.channel, 'Channel')}</Text>
                <Text style={styles.rowValue}>{item.count}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.empty}>No channel data</Text>
          )}
        </AppCard>

        <SectionTitle title="Daily" />
        <AppCard style={styles.card}>
          {stats?.byDay?.length ? (
            stats.byDay.map((item, index) => (
              <View
                key={`${item.date}-${index}`}
                style={[styles.row, index < stats.byDay.length - 1 && styles.divider]}>
                <View>
                  <Text style={styles.rowLabel}>{formatDate(item.date)}</Text>
                  <Text style={styles.meta}>{item.orders} orders</Text>
                </View>
                <Text style={styles.rowValue}>{formatCurrency(item.revenue)}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.empty}>No daily data</Text>
          )}
        </AppCard>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 32 },
  presets: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  preset: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  presetOn: { backgroundColor: colors.brand[50], borderColor: colors.brand[400] },
  presetText: { color: colors.textSecondary, fontWeight: '700', fontSize: 13 },
  presetTextOn: { color: colors.brand[800] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  card: { marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowLabel: { fontWeight: '700', color: colors.text, fontSize: 14 },
  rowValue: { fontWeight: '800', color: colors.brand[800], fontSize: 15 },
  meta: { color: colors.muted, fontSize: 12, fontWeight: '600', marginTop: 2 },
  empty: { color: colors.muted, fontWeight: '600', paddingVertical: 12, textAlign: 'center' },
});
