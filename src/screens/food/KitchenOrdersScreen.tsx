import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ChefHat } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { AppBadge } from '@/components/ui/AppBadge';
import { AppEmpty } from '@/components/ui/AppEmpty';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppLoader } from '@/components/ui/AppLoader';
import { Chip } from '@/components/ui/AppSwitchRow';
import { orderService } from '@/api/services';
import { useToastStore } from '@/store/toastStore';
import { colors, radius } from '@/theme';
import { asArray, getEntityId, getErrorMessage, unwrapPayload } from '@/utils/apiHelpers';
import { formatCurrency, formatDateTime, pickString } from '@/utils/format';
import {
  getOrderCustomerName,
  getOrderItemName,
  getOrderItemQty,
  getOrderItems,
  getOrderTotal,
} from '@/utils/order';
import {
  kitchenBucket,
  kitchenBucketLabel,
  orderChannelLabel,
  orderStatusLabel,
  type KitchenBucket,
} from '@/utils/orderActions';
import type { AppNavigation, Order } from '@/types';

const TABS: Array<KitchenBucket | 'ALL'> = ['NEW', 'PREPARING', 'READY', 'PICKED', 'ALL'];

export function KitchenOrdersScreen() {
  const navigation = useNavigation<AppNavigation>();
  const showToast = useToastStore(s => s.show);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tab, setTab] = useState<KitchenBucket | 'ALL'>('NEW');

  const load = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }
    try {
      const res = await orderService.getAll({ limit: 80 });
      setOrders(asArray<Order>(unwrapPayload(res.data)));
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not load kitchen orders'), 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const counts = useMemo(() => {
    const next: Record<KitchenBucket | 'ALL', number> = {
      ALL: orders.length,
      NEW: 0,
      PREPARING: 0,
      READY: 0,
      PICKED: 0,
    };
    orders.forEach(order => {
      const bucket = kitchenBucket(order);
      if (bucket !== 'CANCELLED') {
        next[bucket] += 1;
      }
    });
    return next;
  }, [orders]);

  const visible = useMemo(() => {
    if (tab === 'ALL') {
      return orders;
    }
    return orders.filter(order => kitchenBucket(order) === tab);
  }, [orders, tab]);

  if (loading && orders.length === 0) {
    return (
      <Screen>
        <AppLoader label="Loading kitchen" />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader title="Kitchen" subtitle={`${counts.NEW} new · ${counts.PREPARING} cooking`} />
      <View style={styles.filters}>
        {TABS.map(item => (
          <Chip
            key={item}
            label={`${kitchenBucketLabel(item)} ${counts[item] || 0}`}
            selected={tab === item}
            onPress={() => setTab(item)}
          />
        ))}
      </View>
      <FlatList
        data={visible}
        keyExtractor={(item, index) => String(getEntityId(item) ?? index)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load(true);
            }}
          />
        }
        ListEmptyComponent={
          <AppEmpty icon={ChefHat} title="Kitchen is clear" subtitle="New food tickets will show up here." />
        }
        renderItem={({ item }) => {
          const id = getEntityId(item);
          const items = getOrderItems(item);
          const first = items[0];
          return (
            <Pressable
              style={styles.row}
              onPress={() => id && navigation.navigate('OrderDetail', { orderId: id })}>
              <View style={styles.copy}>
                <Text style={styles.name}>#{pickString(item.orderNumber, item.id)}</Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {orderChannelLabel(item.orderChannel)} · {formatDateTime(item.createdAt)}
                </Text>
                {first ? (
                  <Text style={styles.items} numberOfLines={1}>
                    {getOrderItemQty(first)}× {getOrderItemName(first)}
                    {items.length > 1 ? ` · +${items.length - 1} more` : ''}
                  </Text>
                ) : null}
                <Text style={styles.customer} numberOfLines={1}>
                  {getOrderCustomerName(item) || 'Guest'} · {formatCurrency(getOrderTotal(item))}
                </Text>
              </View>
              <AppBadge label={orderStatusLabel(item.status, 'FOOD')} />
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  list: { paddingBottom: 24, gap: 10, flexGrow: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  copy: { flex: 1 },
  name: { fontWeight: '800', color: colors.text, fontSize: 16 },
  meta: { color: colors.muted, marginTop: 4, fontWeight: '600', fontSize: 12 },
  items: { color: colors.textSecondary, marginTop: 6, fontWeight: '600', fontSize: 13 },
  customer: { color: colors.text, marginTop: 4, fontWeight: '700', fontSize: 13 },
});
