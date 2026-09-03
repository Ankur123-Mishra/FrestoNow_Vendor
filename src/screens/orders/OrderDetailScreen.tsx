import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import {
  Bike,
  Mail,
  MapPin,
  Package,
  Phone,
  UserRound,
} from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { AppBadge } from '@/components/ui/AppBadge';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppEmpty } from '@/components/ui/AppEmpty';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppInput } from '@/components/ui/AppInput';
import { AppLoader } from '@/components/ui/AppLoader';
import { Chip } from '@/components/ui/AppSwitchRow';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { FOOD_PREP_PRESETS } from '@/config/constants';
import { logisticsService, orderService } from '@/api/services';
import { useModuleStore } from '@/store/moduleStore';
import { useToastStore } from '@/store/toastStore';
import { colors, radius, shadows } from '@/theme';
import { getErrorMessage, unwrapPayload } from '@/utils/apiHelpers';
import { formatCurrency, formatDateTime, pickString, titleCaseStatus } from '@/utils/format';
import {
  acceptRemainingSeconds,
  formatMmSs,
  getOrderActions,
  historyEntryLabel,
  isFoodPendingAccept,
  orderChannelLabel,
  orderStatusLabel,
  shouldTrackDelivery,
} from '@/utils/orderActions';
import type { DeliveryTrack } from '@/types';
import {
  getOrderAddressLines,
  getOrderBillRows,
  getOrderCustomerEmail,
  getOrderCustomerName,
  getOrderCustomerPhone,
  getOrderItemCustomizations,
  getOrderItemImage,
  getOrderItemName,
  getOrderItemPrice,
  getOrderItemQty,
  getOrderItemSku,
  getOrderItemVariantLabel,
  getOrderItems,
  getOrderStatusHistories,
  getOrderTotal,
  unwrapOrder,
} from '@/utils/order';
import type { Order, OrderDetailRoute, OrderItem } from '@/types';

function presentMetric(value: unknown, unit: string): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  const n = Number(value);
  if (Number.isNaN(n)) {
    return '';
  }
  return `${n} ${unit}`;
}

function getSlotLabel(order: Order): string {
  const start = pickString(order.slotStart);
  const end = pickString(order.slotEnd);
  if (start && end) {
    return `${formatDateTime(start)} – ${formatDateTime(end)}`;
  }
  if (start) {
    return formatDateTime(start);
  }
  if (end) {
    return formatDateTime(end);
  }
  return '';
}

const PRE_PICKUP_JOB = new Set(['PENDING', 'ASSIGNED', 'AT_PICKUP']);

export function OrderDetailScreen() {
  const { params } = useRoute<OrderDetailRoute>();
  const showToast = useToastStore(s => s.show);
  const activeModule = useModuleStore(s => s.activeModule);
  const isEcommerce = activeModule === 'ECOMMERCE';
  const isFood = activeModule === 'FOOD';
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [note, setNote] = useState('');
  const [prepTime, setPrepTime] = useState('20');
  const [rejectionReason, setRejectionReason] = useState('');
  const [now, setNow] = useState(Date.now());
  const [track, setTrack] = useState<DeliveryTrack | null>(null);
  const [length, setLength] = useState('10');
  const [breadth, setBreadth] = useState('10');
  const [height, setHeight] = useState('5');
  const [weight, setWeight] = useState('0.5');
  const [awb, setAwb] = useState('');
  const [courierName, setCourierName] = useState('');
  const [rate, setRate] = useState('');
  const [labelUrl, setLabelUrl] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }
    try {
      const res = await orderService.getById(params.orderId);
      const next = unwrapOrder(res.data);
      if (!next) {
        throw new Error('Order not found');
      }
      setOrder(next);
      if (next && shouldTrackDelivery(next, activeModule)) {
        try {
          const trackRes = await logisticsService.getDeliveryTrack(params.orderId);
          setTrack((unwrapPayload(trackRes.data) || trackRes.data) as DeliveryTrack);
        } catch {
          setTrack(null);
        }
      } else {
        setTrack(null);
      }
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not load order'), 'error');
      if (!silent) {
        setOrder(null);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeModule, params.orderId, showToast]);

  React.useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!isFood || !order || !isFoodPendingAccept(order)) {
      return;
    }
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isFood, order]);

  const runAction = async (nextAction: string, actionNote?: string, prepTimeMins?: number) => {
    setBusy(true);
    try {
      await orderService.transitionStatus(
        params.orderId,
        nextAction,
        actionNote ?? (note.trim() || undefined),
        prepTimeMins != null ? { prepTimeMins } : undefined,
      );
      showToast(
        nextAction === 'ACCEPT'
          ? `Order accepted · ${prepTimeMins ?? prepTime} min`
          : `Order ${nextAction.replace(/_/g, ' ').toLowerCase()}`,
        'success',
      );
      setRejectionReason('');
      await load(true);
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not update order status'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const onActionPress = (nextAction: string) => {
    if (nextAction === 'READY') {
      Alert.alert('Mark order ready?', 'Riders are notified as soon as the kitchen marks this ready.', [
        { text: 'Not yet', style: 'cancel' },
        { text: 'Yes, ready', onPress: () => runAction('READY') },
      ]);
      return;
    }
    if (nextAction === 'REJECT' && !rejectionReason.trim()) {
      showToast('Enter a reject reason', 'error');
      return;
    }
    void runAction(
      nextAction,
      nextAction === 'REJECT' || nextAction === 'CANCEL'
        ? rejectionReason.trim() || note.trim() || undefined
        : note.trim() || undefined,
    );
  };

  const createShiprocket = async () => {
    setBusy(true);
    try {
      await logisticsService.createShiprocketShipment(params.orderId, {
        length: Number(length) || 0,
        breadth: Number(breadth) || 0,
        height: Number(height) || 0,
        weight: Number(weight) || 0,
      });
      showToast('Shiprocket shipment created', 'success');
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not create Shiprocket shipment'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const createManual = async () => {
    setBusy(true);
    try {
      await logisticsService.createManualShipment(params.orderId, {
        awb: awb.trim() || undefined,
        courierName: courierName.trim() || undefined,
        labelUrl: labelUrl.trim() || undefined,
        rate: rate ? Number(rate) : undefined,
      });
      showToast('Shipment saved', 'success');
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not create shipment'), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading && !order) {
    return (
      <Screen>
        <AppLoader label="Loading order" />
      </Screen>
    );
  }

  if (!order) {
    return (
      <Screen>
        <AppHeader title="Order details" showBack />
        <AppEmpty
          icon={Package}
          title="Order unavailable"
          subtitle="This order could not be loaded. Pull to retry or go back."
          actionLabel="Retry"
          onAction={() => load()}
        />
      </Screen>
    );
  }

  const items = getOrderItems(order);
  const total = getOrderTotal(order);
  const customer = getOrderCustomerName(order);
  const phone = getOrderCustomerPhone(order);
  const email = getOrderCustomerEmail(order);
  const addressLines = getOrderAddressLines(order);
  const histories = getOrderStatusHistories(order);
  const billRows = getOrderBillRows(order);
  const createdAt = pickString(order.createdAt, order.created_at);
  const fulfillment = order.fulfillmentType ? titleCaseStatus(order.fulfillmentType) : '';
  const channel = order.orderChannel ? orderChannelLabel(order.orderChannel) : '';
  const payment = order.paymentMode ? titleCaseStatus(order.paymentMode) : '';
  const paymentSource = order.paymentSource ? titleCaseStatus(String(order.paymentSource)) : '';
  const paymentOrderId = pickString(order.paymentOrderId);
  const paymentStatus = order.orderStatus ? titleCaseStatus(order.orderStatus) : '';
  const coupon = pickString(order.couponCode);
  const notes = pickString(order.notes);
  const orderRejectionReason = pickString(order.rejectionReason);
  const slotLabel = getSlotLabel(order);
  const eta = presentMetric(order.etaMins, 'mins');
  const distance = presentMetric(order.distanceKm, 'km');
  const heroMeta = [customer, fulfillment || channel, payment].filter(Boolean).join('  ·  ');
  const detailRows = [
    { label: 'Channel', value: channel },
    { label: 'Paid via', value: paymentSource },
    { label: 'Payment ID', value: paymentOrderId },
    { label: 'Prep time', value: presentMetric(order.prepTimeMins, 'mins') },
    { label: 'Delivery slot', value: slotLabel },
    { label: 'ETA', value: eta },
    { label: 'Distance', value: distance },
  ].filter(row => row.value);
  const hasCustomer = Boolean(customer || phone || email);
  const availableActions = getOrderActions(activeModule, order);
  const foodPending = isFood && isFoodPendingAccept(order);
  const job = track?.job;
  const rider = track?.rider;
  const jobStatus = String(job?.status || '').toUpperCase();
  const pickupOtp = job?.pickupOtp?.trim() || '';
  const showPickupOtp = Boolean(pickupOtp) && (PRE_PICKUP_JOB.has(jobStatus) || !jobStatus);
  const acceptLeft = foodPending ? acceptRemainingSeconds(createdAt, now) : 0;

  return (
    <Screen>
      <AppHeader
        title={`#${pickString(order.orderNumber, order.id)}`}
        subtitle={createdAt ? formatDateTime(createdAt) : undefined}
        showBack
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
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
        <AppCard style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.badges}>
              {order.status ? (
                <AppBadge label={orderStatusLabel(order.status, activeModule)} />
              ) : null}
              {paymentStatus ? <AppBadge label={paymentStatus} /> : null}
            </View>
            {total ? <Text style={styles.total}>{formatCurrency(total)}</Text> : null}
          </View>
          {heroMeta ? <Text style={styles.heroMeta}>{heroMeta}</Text> : null}
          {coupon ? <Text style={styles.coupon}>Coupon · {coupon}</Text> : null}
        </AppCard>

        {items.length > 0 ? (
          <>
            <SectionTitle title={`Items (${items.length})`} />
            {items.map(item => (
              <OrderItemCard key={String(item.id)} item={item} />
            ))}
          </>
        ) : null}

        {hasCustomer ? (
          <>
            <SectionTitle title="Customer" />
            <AppCard style={styles.sectionCard}>
              {customer ? <InfoRow icon={UserRound} label="Name" value={customer} /> : null}
              {phone ? (
                <InfoRow
                  icon={Phone}
                  label="Phone"
                  value={phone}
                  onPress={() => Linking.openURL(`tel:${phone}`)}
                />
              ) : null}
              {email ? (
                <InfoRow
                  icon={Mail}
                  label="Email"
                  value={email}
                  onPress={() => Linking.openURL(`mailto:${email}`)}
                />
              ) : null}
            </AppCard>
          </>
        ) : null}

        {addressLines.length > 0 ? (
          <>
            <SectionTitle title="Delivery address" />
            <AppCard style={styles.sectionCard}>
              <View style={styles.addressRow}>
                <View style={styles.iconWrap}>
                  <MapPin size={18} color={colors.brand[700]} />
                </View>
                <View style={styles.flex}>
                  {addressLines.map(line => (
                    <Text key={line} style={styles.addressLine}>
                      {line}
                    </Text>
                  ))}
                </View>
              </View>
            </AppCard>
          </>
        ) : null}

        {detailRows.length > 0 ? (
          <>
            <SectionTitle title="Order info" />
            <AppCard style={styles.sectionCard}>
              {detailRows.map(row => (
                <View key={row.label} style={styles.billRow}>
                  <Text style={styles.billLabel}>{row.label}</Text>
                  <Text style={styles.detailValue}>{row.value}</Text>
                </View>
              ))}
            </AppCard>
          </>
        ) : null}

        {billRows.length > 0 ? (
          <>
            <SectionTitle title="Bill summary" />
            <AppCard style={styles.sectionCard}>
              {billRows.map(row => (
                <View key={row.label} style={[styles.billRow, row.emphasize && styles.billTotal]}>
                  <Text style={[styles.billLabel, row.emphasize && styles.billLabelStrong]}>{row.label}</Text>
                  <Text style={[styles.billValue, row.emphasize && styles.billValueStrong]}>
                    {formatCurrency(row.amount)}
                  </Text>
                </View>
              ))}
            </AppCard>
          </>
        ) : null}

        {notes ? (
          <>
            <SectionTitle title="Notes" />
            <AppCard>
              <Text style={styles.body}>{notes}</Text>
            </AppCard>
          </>
        ) : null}

        {showPickupOtp || rider ? (
          <>
            <SectionTitle title="Rider handoff" />
            <AppCard style={styles.sectionCard}>
              {showPickupOtp ? (
                <View style={styles.otpBox}>
                  <Text style={styles.otpLabel}>Pickup OTP</Text>
                  <Text style={styles.otpValue}>{pickupOtp}</Text>
                  <Text style={styles.muted}>Share this with the rider at pickup</Text>
                </View>
              ) : null}
              {rider ? (
                <InfoRow
                  icon={Bike}
                  label={pickString(rider.name, 'Rider')}
                  value={pickString(rider.phone, jobStatus || 'Assigned')}
                  onPress={rider.phone ? () => Linking.openURL(`tel:${rider.phone}`) : undefined}
                />
              ) : (
                <Text style={styles.muted}>Waiting for a rider to be assigned</Text>
              )}
            </AppCard>
          </>
        ) : null}

        {orderRejectionReason ? (
          <>
            <SectionTitle title="Rejection reason" />
            <AppCard>
              <Text style={styles.body}>{orderRejectionReason}</Text>
            </AppCard>
          </>
        ) : null}

        {histories.length > 0 ? (
          <>
            <SectionTitle title="Status history" />
            <AppCard style={styles.sectionCard}>
              {histories.map((entry, index) => (
                <View
                  key={String(entry.id ?? `${entry.status}-${index}`)}
                  style={[styles.historyRow, index === histories.length - 1 && styles.historyLast]}>
                  <View style={styles.timelineDot} />
                  <View style={styles.flex}>
                    {entry.status ? (
                      <Text style={styles.historyStatus}>
                        {historyEntryLabel(String(entry.status), pickString(entry.note, entry.remarks), activeModule)}
                      </Text>
                    ) : null}
                    {pickString(entry.note, entry.remarks) ? (
                      <Text style={styles.muted}>{pickString(entry.note, entry.remarks)}</Text>
                    ) : null}
                    {pickString(entry.createdAt, entry.created_at) ? (
                      <Text style={styles.historyTime}>
                        {formatDateTime(pickString(entry.createdAt, entry.created_at))}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </AppCard>
          </>
        ) : null}

        {foodPending || availableActions.length > 0 ? (
          <>
            <SectionTitle title={foodPending ? 'Accept order' : 'Update status'} />
            <AppCard style={styles.sectionCard}>
              {foodPending ? (
                <>
                  <Text style={styles.muted}>Prep time for the customer · {formatMmSs(acceptLeft)} left</Text>
                  <View style={styles.chips}>
                    {FOOD_PREP_PRESETS.map(mins => (
                      <Chip
                        key={mins}
                        label={`${mins} min`}
                        selected={prepTime === String(mins)}
                        onPress={() => setPrepTime(String(mins))}
                      />
                    ))}
                  </View>
                  <AppInput
                    label="Custom minutes"
                    keyboardType="number-pad"
                    value={prepTime}
                    onChangeText={setPrepTime}
                    placeholder="20"
                  />
                  <AppButton
                    title={`Accept · ${prepTime} min`}
                    onPress={() =>
                      runAction('ACCEPT', `Kitchen accepted; ETA ${prepTime} minutes`, Number(prepTime) || 20)
                    }
                    loading={busy}
                  />
                  <AppInput
                    label="Reject reason"
                    value={rejectionReason}
                    onChangeText={setRejectionReason}
                    placeholder="Required when rejecting"
                    optional
                  />
                  <AppButton
                    title="Reject order"
                    variant="danger"
                    onPress={() => onActionPress('REJECT')}
                    loading={busy}
                    disabled={!rejectionReason.trim()}
                  />
                </>
              ) : (
                <>
                  {availableActions.map(item => (
                    <AppButton
                      key={item.action}
                      title={item.label}
                      variant={item.danger ? 'danger' : 'primary'}
                      onPress={() => onActionPress(item.action)}
                      loading={busy}
                      style={styles.actionBtn}
                    />
                  ))}
                  <AppInput
                    label="Note"
                    value={note}
                    onChangeText={setNote}
                    placeholder="Optional note"
                    optional
                  />
                </>
              )}
            </AppCard>
          </>
        ) : null}

        {isEcommerce ? (
          <>
            <SectionTitle title="Shiprocket shipment" />
            <AppCard style={styles.sectionCard}>
              <View style={styles.row2}>
                <View style={styles.flex}>
                  <AppInput label="Length" keyboardType="decimal-pad" value={length} onChangeText={setLength} />
                </View>
                <View style={styles.flex}>
                  <AppInput label="Breadth" keyboardType="decimal-pad" value={breadth} onChangeText={setBreadth} />
                </View>
              </View>
              <View style={styles.row2}>
                <View style={styles.flex}>
                  <AppInput label="Height" keyboardType="decimal-pad" value={height} onChangeText={setHeight} />
                </View>
                <View style={styles.flex}>
                  <AppInput label="Weight" keyboardType="decimal-pad" value={weight} onChangeText={setWeight} />
                </View>
              </View>
              <AppButton title="Create Shiprocket shipment" onPress={createShiprocket} loading={busy} />
            </AppCard>

            <SectionTitle title="Manual shipment" />
            <AppCard style={styles.sectionCard}>
              <AppInput label="AWB" value={awb} onChangeText={setAwb} placeholder="AWB9999" optional />
              <AppInput
                label="Courier name"
                value={courierName}
                onChangeText={setCourierName}
                placeholder="Delhivery"
                optional
              />
              <AppInput
                label="Label URL"
                value={labelUrl}
                onChangeText={setLabelUrl}
                autoCapitalize="none"
                placeholder="https://example.com/label"
                optional
              />
              <AppInput label="Rate" keyboardType="decimal-pad" value={rate} onChangeText={setRate} optional />
              <AppButton title="Save manual shipment" variant="outline" onPress={createManual} loading={busy} />
            </AppCard>
          </>
        ) : null}

        {/* POS refund — hidden for now
        <AppButton
          title="POS refund"
          variant="ghost"
          style={styles.mt}
          onPress={() => navigation.navigate('Returns')}
        />
        */}
      </ScrollView>
    </Screen>
  );
}

function OrderItemCard({ item }: { item: OrderItem }) {
  const [failed, setFailed] = useState(false);
  const image = getOrderItemImage(item);
  const name = getOrderItemName(item);
  const qty = getOrderItemQty(item);
  const price = getOrderItemPrice(item);
  const sku = getOrderItemSku(item);
  const variant = getOrderItemVariantLabel(item);
  const customizations = getOrderItemCustomizations(item);
  const status = pickString(item.orderItemStatus, item.status);
  const lineTotal = price && qty ? price * qty : 0;

  return (
    <AppCard style={styles.itemCard}>
      <View style={styles.itemRow}>
        <View style={styles.thumb}>
          {image && !failed ? (
            <Image
              source={{ uri: image }}
              style={styles.image}
              resizeMode="cover"
              onError={() => setFailed(true)}
            />
          ) : (
            <Text style={styles.thumbLetter}>{name.slice(0, 1).toUpperCase()}</Text>
          )}
        </View>
        <View style={styles.itemMeta}>
          <View style={styles.itemTitleRow}>
            <Text style={styles.itemName} numberOfLines={2}>
              {name}
            </Text>
            {status ? <AppBadge label={titleCaseStatus(status)} /> : null}
          </View>
          {variant ? (
            <Text style={styles.itemSub} numberOfLines={2}>
              {variant}
            </Text>
          ) : null}
          {customizations.length > 0 ? (
            <Text style={styles.itemSub} numberOfLines={2}>
              {customizations.join(' · ')}
            </Text>
          ) : null}
          {sku ? (
            <Text style={styles.sku} numberOfLines={1}>
              SKU {sku}
            </Text>
          ) : null}
          <View style={styles.itemFooter}>
            <Text style={styles.itemSub}>
              Qty {qty}
              {price ? ` × ${formatCurrency(price)}` : ''}
            </Text>
            {lineTotal ? <Text style={styles.lineTotal}>{formatCurrency(lineTotal)}</Text> : null}
          </View>
        </View>
      </View>
    </AppCard>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  onPress,
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
  onPress?: () => void;
}) {
  if (!value) {
    return null;
  }
  const content = (
    <View style={styles.infoRow}>
      <View style={styles.iconWrap}>
        <Icon size={18} color={colors.brand[700]} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
  if (!onPress) {
    return content;
  }
  return (
    <Pressable onPress={onPress} style={({ pressed }) => (pressed ? styles.pressed : undefined)}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 36 },
  hero: { marginBottom: 8, ...shadows.sm },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  badges: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  total: { fontSize: 22, fontWeight: '800', color: colors.brand[800] },
  heroMeta: { color: colors.textSecondary, marginTop: 12, fontSize: 13, lineHeight: 20 },
  coupon: { color: colors.brand[700], marginTop: 8, fontWeight: '700', fontSize: 12 },
  muted: { color: colors.muted, fontSize: 13 },
  body: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
  sectionCard: { marginBottom: 4 },
  itemCard: { marginBottom: 12, padding: 12 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  thumb: {
    width: 84,
    height: 84,
    borderRadius: radius.md,
    backgroundColor: colors.brand[50],
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  image: { width: '100%', height: '100%' },
  thumbLetter: { fontWeight: '800', color: colors.brand[700], fontSize: 22 },
  itemMeta: { flex: 1, minWidth: 0, gap: 4 },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  itemName: { flex: 1, fontWeight: '800', color: colors.text, fontSize: 15, lineHeight: 20 },
  itemSub: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  sku: { color: colors.textSecondary, fontSize: 11, letterSpacing: 0.2 },
  itemFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    gap: 8,
  },
  lineTotal: { fontWeight: '800', color: colors.brand[800], fontSize: 14 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 8 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.brand[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: { color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  infoValue: { color: colors.text, fontWeight: '700', fontSize: 14, marginTop: 2 },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  addressLine: { color: colors.text, fontSize: 14, lineHeight: 21, fontWeight: '600' },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  billTotal: {
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  billLabel: { color: colors.muted, fontSize: 13 },
  billLabelStrong: { color: colors.text, fontWeight: '800', fontSize: 15 },
  billValue: { color: colors.textSecondary, fontWeight: '700' },
  billValueStrong: { color: colors.brand[800], fontWeight: '800', fontSize: 16 },
  detailValue: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 13,
    flex: 1,
    textAlign: 'right',
    marginLeft: 12,
  },
  historyRow: {
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 14,
    borderLeftWidth: 2,
    borderLeftColor: colors.brand[100],
    marginLeft: 7,
    paddingLeft: 16,
  },
  historyLast: { borderLeftColor: 'transparent', paddingBottom: 0 },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.brand[600],
    marginLeft: -23,
    marginTop: 4,
  },
  historyStatus: { fontWeight: '800', color: colors.text, fontSize: 14 },
  historyTime: { color: colors.muted, fontSize: 12, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 },
  actionBtn: { marginBottom: 10 },
  otpBox: {
    backgroundColor: colors.brand[50],
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 10,
  },
  otpLabel: { color: colors.muted, fontWeight: '700', fontSize: 11, letterSpacing: 0.4 },
  otpValue: {
    color: colors.brand[800],
    fontWeight: '800',
    fontSize: 28,
    letterSpacing: 4,
    marginTop: 4,
  },
  row2: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1, minWidth: 0 },
  // mt: { marginTop: 10 },
  pressed: { opacity: 0.72 },
});
