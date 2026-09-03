import React, { useCallback, useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ClipboardList, Package } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { AppBadge } from '@/components/ui/AppBadge';
import { AppEmpty } from '@/components/ui/AppEmpty';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppLoader } from '@/components/ui/AppLoader';
import { orderService } from '@/api/services';
import { useModuleStore } from '@/store/moduleStore';
import { useToastStore } from '@/store/toastStore';
import { colors, radius, shadows } from '@/theme';
import { asArray, getEntityId, getErrorMessage, unwrapPayload } from '@/utils/apiHelpers';
import { formatCurrency, formatDateTime, pickString, titleCaseStatus } from '@/utils/format';
import {
  getOrderCustomerName,
  getOrderItemImage,
  getOrderItemName,
  getOrderItemPrice,
  getOrderItemQty,
  getOrderItems,
  getOrderTotal,
} from '@/utils/order';
import { orderChannelLabel, orderStatusLabel } from '@/utils/orderActions';
import type { AppNavigation, Order, OrderItem } from '@/types';
import type { ModuleType } from '@/config/constants';

const PREVIEW_COUNT = 3;

export function OrderListScreen() {
  const navigation = useNavigation<AppNavigation>();
  const showToast = useToastStore(s => s.show);
  const activeModule = useModuleStore(s => s.activeModule);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);

  const load = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }
    try {
      const res = await orderService.getAll();
      setOrders(asArray<Order>(unwrapPayload(res.data)));
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not load orders'), 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast, activeModule]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (loading && orders.length === 0) {
    return (
      <Screen>
        <AppLoader label="Loading orders" />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader title="Orders" subtitle={`${orders.length} total`} />
      <FlatList
        data={orders}
        keyExtractor={(item, index) => String(getEntityId(item) ?? index)}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} />
        }
        ListEmptyComponent={
          <AppEmpty icon={ClipboardList} title="No orders yet" subtitle="New customer orders will appear here." />
        }
        renderItem={({ item }) => {
          const id = getEntityId(item);
          return (
            <OrderCard
              order={item}
              onPress={() => id && navigation.navigate('OrderDetail', { orderId: id })}
              moduleType={activeModule}
            />
          );
        }}
      />
    </Screen>
  );
}

function OrderCard({
  order,
  onPress,
  moduleType,
}: {
  order: Order;
  onPress: () => void;
  moduleType: ModuleType;
}) {
  const items = getOrderItems(order);
  const firstItem = items[0];
  const extraCount = Math.max(items.length - 1, 0);
  const previewItems = items.slice(0, PREVIEW_COUNT);
  const totalQty = items.reduce((sum, row) => sum + getOrderItemQty(row), 0);
  const fulfillmentRaw = pickString(order.fulfillmentType, order.orderChannel);
  const fulfillment = fulfillmentRaw
    ? orderChannelLabel(order.orderChannel) || titleCaseStatus(fulfillmentRaw)
    : '';
  const payment = order.paymentMode ? titleCaseStatus(order.paymentMode) : '';

  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && styles.cardPressed]} onPress={onPress}>
      <View style={styles.cardHeader}>
        <View style={styles.headerText}>
          <Text style={styles.orderNo} numberOfLines={1}>
            #{pickString(order.orderNumber, order.id, 'Order')}
          </Text>
          <Text style={styles.metaLine} numberOfLines={1}>
            {formatDateTime(order.createdAt || order.created_at)}
            {fulfillment ? ` · ${fulfillment}` : ''}
          </Text>
        </View>
        <AppBadge label={orderStatusLabel(order.status, moduleType)} />
      </View>

      {firstItem ? (
        <View style={styles.itemRow}>
          <ItemThumbs items={previewItems} extraCount={items.length - PREVIEW_COUNT} />
          <View style={styles.itemMeta}>
            <Text style={styles.itemName} numberOfLines={2}>
              {getOrderItemName(firstItem)}
            </Text>
            <Text style={styles.itemSub} numberOfLines={1}>
              Qty {getOrderItemQty(firstItem)}
              {getOrderItemPrice(firstItem) ? ` · ${formatCurrency(getOrderItemPrice(firstItem))}` : ''}
              {extraCount > 0 ? ` · +${extraCount} more` : totalQty > 1 ? ` · ${totalQty} items` : ''}
            </Text>
          </View>
        </View>
      ) : null}

      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          <Text style={styles.customer} numberOfLines={1}>
            {getOrderCustomerName(order)}
          </Text>
          {payment ? (
            <Text style={styles.payment} numberOfLines={1}>
              {payment}
            </Text>
          ) : null}
        </View>
        <Text style={styles.total}>{formatCurrency(getOrderTotal(order))}</Text>
      </View>
    </Pressable>
  );
}

function ItemThumbs({ items, extraCount }: { items: OrderItem[]; extraCount: number }) {
  if (items.length === 0) {
    return (
      <View style={styles.thumb}>
        <Package size={22} color={colors.brand[600]} />
      </View>
    );
  }

  if (items.length === 1) {
    return <ThumbImage item={items[0]} />;
  }

  return (
    <View style={styles.thumbStack}>
      {items.map((item, index) => (
        <View
          key={String(item.id ?? index)}
          style={[styles.stackThumb, { marginLeft: index === 0 ? 0 : -16, zIndex: items.length - index }]}>
          <ThumbImage item={item} compact />
        </View>
      ))}
      {extraCount > 0 ? (
        <View style={[styles.stackThumb, styles.moreThumb, { marginLeft: -16, zIndex: 0 }]}>
          <Text style={styles.moreText}>+{extraCount}</Text>
        </View>
      ) : null}
    </View>
  );
}

function ThumbImage({ item, compact }: { item: OrderItem; compact?: boolean }) {
  const uri = getOrderItemImage(item);
  return (
    <View style={[styles.thumb, compact && styles.thumbCompact]}>
      {uri ? (
        <Image source={{ uri }} style={styles.image} />
      ) : (
        <Text style={styles.thumbLetter}>{getOrderItemName(item).slice(0, 1).toUpperCase()}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 24, gap: 12, flexGrow: 1 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  cardPressed: { opacity: 0.92 },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerText: { flex: 1 },
  orderNo: { fontWeight: '800', color: colors.text, fontSize: 15, letterSpacing: 0.2 },
  metaLine: { color: colors.muted, marginTop: 3, fontSize: 12 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: 10,
  },
  itemMeta: { flex: 1, minWidth: 0 },
  itemName: { fontWeight: '700', color: colors.text, fontSize: 14, lineHeight: 20 },
  itemSub: { color: colors.muted, marginTop: 4, fontSize: 12 },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    backgroundColor: colors.brand[50],
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumbCompact: { width: 48, height: 48 },
  image: { width: '100%', height: '100%' },
  thumbLetter: { fontWeight: '800', color: colors.brand[700], fontSize: 18 },
  thumbStack: { flexDirection: 'row', alignItems: 'center', minWidth: 64 },
  stackThumb: {
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  moreThumb: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.brand[100],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  moreText: { fontWeight: '800', color: colors.brand[800], fontSize: 12 },
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerLeft: { flex: 1, minWidth: 0 },
  customer: { fontWeight: '700', color: colors.textSecondary, fontSize: 13 },
  payment: { color: colors.muted, marginTop: 2, fontSize: 12 },
  total: { fontWeight: '800', color: colors.brand[800], fontSize: 17 },
});
