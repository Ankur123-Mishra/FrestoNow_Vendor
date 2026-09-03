import React, { useCallback, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  Ban,
  CircleCheck,
  IndianRupee,
  Percent,
  ShoppingBag,
  TrendingUp,
} from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppLoader } from '@/components/ui/AppLoader';
import { AppCard } from '@/components/ui/AppCard';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { StatCard } from '@/components/ui/StatCard';
import { vendorService } from '@/api/services';
import { getModuleMeta } from '@/config/modules';
import { useAuthStore } from '@/store/authStore';
import { getActiveModule, useModuleStore } from '@/store/moduleStore';
import { useToastStore } from '@/store/toastStore';
import { colors } from '@/theme';
import { getErrorMessage, mapDashboardStats } from '@/utils/apiHelpers';
import { formatCurrency, formatDate, pickString } from '@/utils/format';
import { useResponsive } from '@/utils/responsive';
import type { DashboardStats } from '@/types';

export function DashboardScreen() {
  const user = useAuthStore(s => s.user);
  const refreshProfile = useAuthStore(s => s.refreshProfile);
  const showToast = useToastStore(s => s.show);
  const activeModule = useModuleStore(s => s.activeModule);
  const meta = getModuleMeta(activeModule);
  const { isTablet } = useResponsive();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const requestIdRef = useRef(0);
  const statsRef = useRef<DashboardStats | null>(null);
  statsRef.current = stats;

  const load = useCallback(async (silent = false) => {
    const requestId = ++requestIdRef.current;
    if (!silent) {
      setLoading(true);
    }
    try {
      await refreshProfile();
      if (requestId !== requestIdRef.current) {
        return;
      }
      const reportsRes = await vendorService.getReports(getActiveModule());
      if (requestId !== requestIdRef.current) {
        return;
      }
      setStats(mapDashboardStats(reportsRes.data));
    } catch (error) {
      if (requestId === requestIdRef.current) {
        showToast(getErrorMessage(error, 'Could not load dashboard'), 'error');
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [refreshProfile, showToast]);

  useFocusEffect(
    useCallback(() => {
      void load(statsRef.current != null);
      return () => {
        requestIdRef.current += 1;
      };
    }, [load, activeModule]),
  );

  const greeting = pickString(user?.name, user?.shopname, 'Vendor');
  const totals = stats?.totals;

  if (loading && !refreshing) {
    return (
      <Screen>
        <View style={styles.loaderWrap}>
          <AppLoader label="Fetching dashboard" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} />
        }>
        <AppHeader title={`Hi, ${greeting}`} subtitle={meta.dashboardSubtitle} />

        <View style={[styles.grid, isTablet && styles.gridWide]}>
          <StatCard label="Orders" value={String(totals?.orders ?? 0)} icon={ShoppingBag} />
          <StatCard
            label="Completed"
            value={String(totals?.completed ?? 0)}
            icon={CircleCheck}
            tint={colors.success}
          />
          <StatCard
            label="Canceled"
            value={String(totals?.canceled ?? 0)}
            icon={Ban}
            tint={colors.danger}
          />
          <StatCard
            label="Revenue"
            value={formatCurrency(totals?.revenue)}
            icon={IndianRupee}
            tint={colors.brand[700]}
          />
          <StatCard
            label="Avg. order value"
            value={formatCurrency(totals?.averageOrderValue)}
            icon={TrendingUp}
            tint={colors.info}
          />
          <StatCard
            label="Cancel rate"
            value={`${totals?.cancelRate ?? 0}%`}
            icon={Percent}
            tint={colors.warning}
          />
        </View>

        {/* <SectionTitle title="By status" />
        <AppCard style={styles.sectionCard}>
          {stats?.byStatus.length ? (
            stats.byStatus.map((item, index) => (
              <View
                key={`${item.status}-${index}`}
                style={[styles.row, index < stats.byStatus.length - 1 && styles.rowDivider]}>
                <AppBadge label={titleCaseStatus(item.status)} />
                <Text style={styles.rowValue}>{item.count}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.empty}>No status data</Text>
          )}
        </AppCard>

        <SectionTitle title="By channel" />
        <AppCard style={styles.sectionCard}>
          {stats?.byChannel.length ? (
            stats.byChannel.map((item, index) => (
              <View
                key={`${item.channel}-${index}`}
                style={[styles.row, index < stats.byChannel.length - 1 && styles.rowDivider]}>
                <Text style={styles.rowLabel}>{titleCaseStatus(item.channel)}</Text>
                <Text style={styles.rowValue}>{item.count}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.empty}>No channel data</Text>
          )}
        </AppCard> */}

        <SectionTitle title="Daily orders" />
        <AppCard style={styles.sectionCard}>
          {stats?.byDay.length ? (
            stats.byDay.map((item, index) => (
              <View
                key={`${item.date}-${index}`}
                style={[styles.dayRow, index < stats.byDay.length - 1 && styles.rowDivider]}>
                <View>
                  <Text style={styles.rowLabel}>{formatDate(item.date)}</Text>
                  <Text style={styles.dayMeta}>{item.orders} {item.orders === 1 ? 'order' : 'orders'}</Text>
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
  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingBottom: 32 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
  gridWide: { gap: 14 },
  sectionCard: { marginBottom: 8, paddingVertical: 4 },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLabel: { fontWeight: '700', color: colors.text, fontSize: 14 },
  rowValue: { fontWeight: '800', color: colors.brand[800], fontSize: 15 },
  dayMeta: { marginTop: 2, color: colors.muted, fontSize: 12, fontWeight: '600' },
  empty: { color: colors.muted, fontWeight: '600', paddingVertical: 12, textAlign: 'center' },
});
