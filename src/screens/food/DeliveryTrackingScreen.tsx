import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Linking, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Bike, Phone } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { AppBadge } from '@/components/ui/AppBadge';
import { AppEmpty } from '@/components/ui/AppEmpty';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppLoader } from '@/components/ui/AppLoader';
import { logisticsService, orderService } from '@/api/services';
import { useToastStore } from '@/store/toastStore';
import { colors, radius } from '@/theme';
import { asArray, getEntityId, getErrorMessage, unwrapPayload } from '@/utils/apiHelpers';
import { formatCurrency, pickString } from '@/utils/format';
import { getOrderCustomerName, getOrderCustomerPhone, getOrderTotal } from '@/utils/order';
import { isDeliveryPhase, orderStatusLabel } from '@/utils/orderActions';
import type { AppNavigation, DeliveryTrack, Order } from '@/types';

const PRE_PICKUP_JOB = new Set(['PENDING', 'ASSIGNED', 'AT_PICKUP', '']);

function TrackRow({
  order,
  onOpen,
}: {
  order: Order;
  onOpen: () => void;
}) {
  const [track, setTrack] = useState<DeliveryTrack | null>(null);

  useFocusEffect(
    useCallback(() => {
      const id = getEntityId(order);
      if (!id) {
        return;
      }
      let active = true;
      logisticsService
        .getDeliveryTrack(id)
        .then(res => {
          if (active) {
            setTrack((unwrapPayload(res.data) || res.data) as DeliveryTrack);
          }
        })
        .catch(() => {
          if (active) {
            setTrack(null);
          }
        });
      return () => {
        active = false;
      };
    }, [order]),
  );

  const rider = track?.rider;
  const otp = track?.job?.pickupOtp?.trim();
  const jobStatus = String(track?.job?.status || '').toUpperCase();
  const showOtp = Boolean(otp) && PRE_PICKUP_JOB.has(jobStatus);
  const phone = pickString(rider?.phone, getOrderCustomerPhone(order));

  return (
    <Pressable style={styles.card} onPress={onOpen}>
      <View style={styles.cardHead}>
        <Text style={styles.orderNo}>#{pickString(order.orderNumber, order.id)}</Text>
        <AppBadge label={orderStatusLabel(order.status, 'FOOD')} />
      </View>
      <Text style={styles.customer}>{getOrderCustomerName(order) || 'Customer'}</Text>
      <Text style={styles.meta}>{formatCurrency(getOrderTotal(order))}</Text>
      {rider ? (
        <Text style={styles.rider}>Rider · {pickString(rider.name, 'Assigned')}</Text>
      ) : (
        <Text style={styles.meta}>Waiting for rider assign</Text>
      )}
      {showOtp ? <Text style={styles.otp}>OTP {otp}</Text> : null}
      {phone ? (
        <Pressable style={styles.call} onPress={() => Linking.openURL(`tel:${phone}`)}>
          <Phone size={14} color={colors.brand[700]} />
          <Text style={styles.callText}>{phone}</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

export function DeliveryTrackingScreen() {
  const navigation = useNavigation<AppNavigation>();
  const showToast = useToastStore(s => s.show);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await orderService.getAll({ limit: 50 });
      setOrders(asArray<Order>(unwrapPayload(res.data)));
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not load deliveries'), 'error');
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

  const deliveries = useMemo(
    () =>
      orders.filter(order => {
        const status = String(order.status || '').toUpperCase();
        return (status === 'CONFIRMED' || status === 'SHIPPED') && isDeliveryPhase(order);
      }),
    [orders],
  );

  if (loading && orders.length === 0) {
    return (
      <Screen>
        <AppLoader label="Loading deliveries" />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader title="Delivery tracking" subtitle={`${deliveries.length} active`} showBack />
      <FlatList
        data={deliveries}
        keyExtractor={(item, index) => String(getEntityId(item) ?? index)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
        ListEmptyComponent={
          <AppEmpty icon={Bike} title="No live deliveries" subtitle="Orders ready for rider pickup will appear here." />
        }
        renderItem={({ item }) => {
          const id = getEntityId(item);
          return (
            <TrackRow
              order={item}
              onOpen={() => id && navigation.navigate('OrderDetail', { orderId: id })}
            />
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 24, gap: 10, flexGrow: 1 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  orderNo: { fontWeight: '800', color: colors.text, fontSize: 16 },
  customer: { fontWeight: '700', color: colors.text, marginTop: 8 },
  meta: { color: colors.muted, marginTop: 4, fontWeight: '600' },
  rider: { color: colors.textSecondary, marginTop: 6, fontWeight: '700' },
  otp: { marginTop: 8, fontWeight: '800', letterSpacing: 2, color: colors.brand[800], fontSize: 18 },
  call: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  callText: { color: colors.brand[700], fontWeight: '700' },
});
