import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { Screen } from '@/components/layout/Screen';
import { AppBadge } from '@/components/ui/AppBadge';
import { AppCard } from '@/components/ui/AppCard';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppLoader } from '@/components/ui/AppLoader';
import { foodService } from '@/api/services';
import { useToastStore } from '@/store/toastStore';
import { colors, radius } from '@/theme';
import { asArray, getErrorMessage, unwrapPayload } from '@/utils/apiHelpers';
import { formatDateTime, pickString, titleCaseStatus } from '@/utils/format';
import { getOrderItemName, getOrderItemQty } from '@/utils/order';
import type { KitchenOrder, KitchenOrderDetailRoute, OrderItem } from '@/types';

export function KitchenOrderDetailScreen() {
  const route = useRoute<KitchenOrderDetailRoute>();
  const showToast = useToastStore(s => s.show);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [order, setOrder] = useState<KitchenOrder | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await foodService.getKitchenOrder(route.params.orderId);
      setOrder((unwrapPayload(res.data) || {}) as KitchenOrder);
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not load kitchen ticket'), 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [route.params.orderId, showToast]);

  React.useEffect(() => {
    load();
  }, [load]);

  if (loading && !order) {
    return (
      <Screen>
        <AppLoader label="Loading ticket" />
      </Screen>
    );
  }

  const items = asArray<OrderItem>(order?.items || order?.orderItems);

  return (
    <Screen>
      <AppHeader title={`Ticket #${route.params.orderId}`} subtitle="Kitchen order" showBack />
      <ScrollView
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
        <AppCard>
          <View style={styles.top}>
            <Text style={styles.title}>{pickString(order?.tableName, order?.fulfillmentType, 'Kitchen ticket')}</Text>
            <AppBadge label={titleCaseStatus(order?.status) || 'Active'} />
          </View>
          <Text style={styles.meta}>{formatDateTime(order?.createdAt)}</Text>
        </AppCard>
        <Text style={styles.section}>Items</Text>
        {items.length ? (
          items.map((item, index) => (
            <View key={String(item.id ?? index)} style={styles.item}>
              <Text style={styles.itemName}>{getOrderItemName(item)}</Text>
              <Text style={styles.qty}>x{getOrderItemQty(item)}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.empty}>No items on this ticket</Text>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 32, gap: 10 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  title: { fontWeight: '800', fontSize: 18, color: colors.text, flex: 1 },
  meta: { color: colors.muted, marginTop: 8, fontWeight: '600' },
  section: { fontWeight: '800', color: colors.text, marginTop: 8 },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemName: { fontWeight: '700', color: colors.text, flex: 1, paddingRight: 8 },
  qty: { fontWeight: '800', color: colors.brand[800] },
  empty: { color: colors.muted, fontWeight: '600', textAlign: 'center', paddingVertical: 16 },
});
