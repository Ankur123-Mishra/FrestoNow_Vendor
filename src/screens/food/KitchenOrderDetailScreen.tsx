import React, { useCallback, useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Screen } from '@/components/layout/Screen';
import { AppBadge } from '@/components/ui/AppBadge';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppInput } from '@/components/ui/AppInput';
import { AppLoader } from '@/components/ui/AppLoader';
import { Chip } from '@/components/ui/AppSwitchRow';
import { FOOD_PREP_PRESETS } from '@/config/constants';
import { orderService } from '@/api/services';
import { useToastStore } from '@/store/toastStore';
import { colors, radius } from '@/theme';
import { getErrorMessage } from '@/utils/apiHelpers';
import { formatCurrency, formatDateTime, pickString, titleCaseStatus } from '@/utils/format';
import {
  getOrderCustomerName,
  getOrderItemAddonLabels,
  getOrderItemName,
  getOrderItemQty,
  getOrderItems,
  getOrderTotal,
  unwrapOrder,
} from '@/utils/order';
import {
  acceptRemainingSeconds,
  formatMmSs,
  getOrderActions,
  isFoodPendingAccept,
  kitchenBucket,
  kitchenBucketLabel,
  orderChannelLabel,
  orderStatusLabel,
} from '@/utils/orderActions';
import type { AppNavigation, KitchenOrderDetailRoute, Order, OrderItem } from '@/types';

export function KitchenOrderDetailScreen() {
  const route = useRoute<KitchenOrderDetailRoute>();
  const navigation = useNavigation<AppNavigation>();
  const showToast = useToastStore(s => s.show);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [prepTime, setPrepTime] = useState('20');
  const [rejectReason, setRejectReason] = useState('');
  const [now, setNow] = useState(Date.now());

  const load = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
      }
      try {
        const res = await orderService.getById(route.params.orderId);
        const next = unwrapOrder(res.data);
        if (!next) {
          throw new Error('Order not found');
        }
        setOrder(next);
      } catch (error) {
        showToast(getErrorMessage(error, 'Could not load kitchen ticket'), 'error');
        if (!silent) {
          setOrder(null);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [route.params.orderId, showToast],
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!order || !isFoodPendingAccept(order)) {
      return;
    }
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [order]);

  const runAction = async (action: string, note?: string, prepTimeMins?: number) => {
    setBusy(true);
    try {
      await orderService.transitionStatus(
        route.params.orderId,
        action,
        note,
        prepTimeMins != null ? { prepTimeMins } : undefined,
      );
      const labels: Record<string, string> = {
        ACCEPT: `Accepted · ${prepTimeMins ?? prepTime} min`,
        READY: 'Marked ready',
        SERVED: 'Marked served',
        COLLECT: 'Guest collected',
        REJECT: 'Order rejected',
      };
      showToast(labels[action] ?? `Order ${action.toLowerCase()}`, 'success');
      setRejectReason('');
      await load(true);
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not update kitchen status'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const onAction = (action: string) => {
    if (action === 'ACCEPT') {
      void runAction('ACCEPT', undefined, Number(prepTime) || 20);
      return;
    }
    if (action === 'READY') {
      Alert.alert('Mark ready?', 'Ticket moves to the Ready / pickup bucket.', [
        { text: 'Not yet', style: 'cancel' },
        { text: 'Yes, ready', onPress: () => void runAction('READY') },
      ]);
      return;
    }
    if (action === 'SERVED') {
      Alert.alert('Mark served?', 'Food has been served at the table.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Served', onPress: () => void runAction('SERVED') },
      ]);
      return;
    }
    if (action === 'COLLECT') {
      Alert.alert('Guest collected?', 'Takeaway / self-pickup handoff complete.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Collected', onPress: () => void runAction('COLLECT') },
      ]);
      return;
    }
    if (action === 'REJECT' || action === 'CANCEL') {
      if (!rejectReason.trim()) {
        showToast('Enter a reject reason', 'error');
        return;
      }
      Alert.alert('Reject this ticket?', rejectReason.trim(), [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: () => void runAction('REJECT', rejectReason.trim()),
        },
      ]);
    }
  };

  if (loading && !order) {
    return (
      <Screen>
        <AppLoader label="Loading ticket" />
      </Screen>
    );
  }

  if (!order) {
    return (
      <Screen>
        <AppHeader title="Kitchen ticket" showBack />
        <Text style={styles.empty}>Ticket unavailable. Pull to retry.</Text>
      </Screen>
    );
  }

  const items = getOrderItems(order);
  const actions = getOrderActions('FOOD', order);
  const primary = actions.find(a => !a.danger);
  const danger = actions.find(a => a.danger);
  const bucket = kitchenBucket(order);
  const pending = isFoodPendingAccept(order);
  const acceptLeft = pending ? acceptRemainingSeconds(pickString(order.createdAt, order.created_at), now) : 0;
  const channel = orderChannelLabel(order.orderChannel);
  const guest = getOrderCustomerName(order) || 'Guest';
  const tableOrToken = order.tableNumber
    ? `Table ${order.tableNumber}`
    : order.tokenNumber != null
      ? `Token #${order.tokenNumber}`
      : channel;

  return (
    <Screen>
      <AppHeader
        title={`#${pickString(order.orderNumber, order.id)}`}
        subtitle={`${kitchenBucketLabel(bucket === 'CANCELLED' ? 'ALL' : bucket)} · ${channel}`}
        showBack
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load(true);
            }}
          />
        }>
        <AppCard>
          <View style={styles.top}>
            <Text style={styles.title}>{tableOrToken}</Text>
            <AppBadge label={orderStatusLabel(order.status, 'FOOD')} />
          </View>
          <Text style={styles.meta}>
            {guest}
            {order.waiterName ? ` · Waiter ${order.waiterName}` : ''}
          </Text>
          <Text style={styles.meta}>{formatDateTime(pickString(order.createdAt, order.created_at))}</Text>
          {pending ? (
            <Text style={[styles.sla, { color: colors.warning }]}>Accept within {formatMmSs(acceptLeft)}</Text>
          ) : null}
          <Text style={styles.total}>{formatCurrency(getOrderTotal(order))}</Text>
        </AppCard>

        <Text style={styles.section}>Items</Text>
        {items.length ? (
          items.map((item, index) => <KitchenLine key={String(item.id ?? index)} item={item} />)
        ) : (
          <Text style={styles.empty}>No items on this ticket</Text>
        )}

        {pending ? (
          <View style={styles.card}>
            <Text style={styles.section}>Prep time (mins)</Text>
            <View style={styles.chips}>
              {FOOD_PREP_PRESETS.map(mins => (
                <Chip
                  key={mins}
                  label={`${mins}`}
                  selected={prepTime === String(mins)}
                  onPress={() => setPrepTime(String(mins))}
                />
              ))}
            </View>
            <AppInput
              label="Custom"
              value={prepTime}
              onChangeText={setPrepTime}
              keyboardType="number-pad"
              optional
            />
          </View>
        ) : null}

        {danger ? (
          <View style={styles.card}>
            <AppInput
              label="Reject reason"
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="Sold out / kitchen closed…"
            />
          </View>
        ) : null}

        <View style={styles.actions}>
          {primary ? (
            <AppButton
              title={
                primary.action === 'ACCEPT'
                  ? `Accept (${formatMmSs(acceptLeft)})`
                  : primary.label
              }
              loading={busy}
              onPress={() => onAction(primary.action)}
            />
          ) : null}
          {danger ? (
            <AppButton
              title={danger.label}
              variant="danger"
              loading={busy}
              onPress={() => onAction(danger.action)}
            />
          ) : null}
          <AppButton
            title="Full order details"
            variant="outline"
            onPress={() => navigation.navigate('OrderDetail', { orderId: route.params.orderId })}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

function KitchenLine({ item }: { item: OrderItem }) {
  const status = titleCaseStatus(item.orderItemStatus || item.status);
  const addons = getOrderItemAddonLabels(item);
  return (
    <View style={styles.item}>
      <View style={styles.flex}>
        <Text style={styles.itemName}>
          {getOrderItemQty(item)}× {getOrderItemName(item)}
        </Text>
        {addons.length ? <Text style={styles.itemStatus}>{addons.join(' · ')}</Text> : null}
        {status ? <Text style={styles.itemStatus}>{status}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 32, gap: 10 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  title: { fontWeight: '800', fontSize: 18, color: colors.text, flex: 1 },
  meta: { color: colors.muted, marginTop: 6, fontWeight: '600' },
  sla: { marginTop: 8, fontWeight: '800' },
  total: { marginTop: 10, fontWeight: '800', fontSize: 18, color: colors.brand[800] },
  section: { fontWeight: '800', color: colors.text, marginTop: 4 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginVertical: 6 },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  flex: { flex: 1 },
  itemName: { fontWeight: '700', color: colors.text },
  itemStatus: { marginTop: 4, color: colors.muted, fontWeight: '600', fontSize: 12 },
  empty: { color: colors.muted, fontWeight: '600', textAlign: 'center', paddingVertical: 16 },
  actions: { gap: 8, marginTop: 8 },
});
