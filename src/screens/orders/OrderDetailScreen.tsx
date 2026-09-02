import React, { useCallback, useState } from 'react';
import {
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
  CreditCard,
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
import { ORDER_ACTIONS } from '@/config/constants';
import type { OrderAction } from '@/config/constants';
import { logisticsService, orderService } from '@/api/services';
import { useToastStore } from '@/store/toastStore';
import { colors, radius, shadows } from '@/theme';
import { getErrorMessage } from '@/utils/apiHelpers';
import { formatCurrency, formatDateTime, pickString, titleCaseStatus } from '@/utils/format';
import {
  getOrderAddressLines,
  getOrderBillRows,
  getOrderCustomerEmail,
  getOrderCustomerName,
  getOrderCustomerPhone,
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

export function OrderDetailScreen() {
  const { params } = useRoute<OrderDetailRoute>();
  const showToast = useToastStore(s => s.show);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [action, setAction] = useState<OrderAction>('ACCEPT');
  const [note, setNote] = useState('Preparing your order');
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
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not load order'), 'error');
      if (!silent) {
        setOrder(null);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [params.orderId, showToast]);

  React.useEffect(() => {
    load();
  }, [load]);

  const transition = async () => {
    setBusy(true);
    try {
      await orderService.transitionStatus(params.orderId, action, note.trim() || undefined);
      showToast(`Order ${action.toLowerCase()}ed`, 'success');
      await load(true);
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not update order status'), 'error');
    } finally {
      setBusy(false);
    }
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
  const fulfillmentRaw = pickString(order.fulfillmentType, order.orderChannel);
  const fulfillment = fulfillmentRaw ? titleCaseStatus(fulfillmentRaw) : '';
  const payment = order.paymentMode ? titleCaseStatus(order.paymentMode) : '';
  const paymentStatus = order.orderStatus ? titleCaseStatus(order.orderStatus) : '';

  return (
    <Screen>
      <AppHeader
        title={`#${pickString(order.orderNumber, order.id)}`}
        subtitle={formatDateTime(order.createdAt || order.created_at)}
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
              <AppBadge label={titleCaseStatus(order.status)} />
              {paymentStatus ? <AppBadge label={paymentStatus} /> : null}
            </View>
            <Text style={styles.total}>{formatCurrency(total)}</Text>
          </View>
          <Text style={styles.heroMeta}>
            {[customer, fulfillment, payment].filter(Boolean).join('  ·  ')}
          </Text>
          {order.couponCode ? (
            <Text style={styles.coupon}>Coupon · {String(order.couponCode)}</Text>
          ) : null}
        </AppCard>

        <SectionTitle title={`Items (${items.length})`} />
        {items.length === 0 ? (
          <AppCard>
            <Text style={styles.muted}>No line items returned by the API.</Text>
          </AppCard>
        ) : (
          items.map(item => <OrderItemCard key={String(item.id)} item={item} />)
        )}

        <SectionTitle title="Customer" />
        <AppCard style={styles.sectionCard}>
          <InfoRow icon={UserRound} label="Name" value={customer} />
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
          {payment ? (
            <View style={styles.payRow}>
              <CreditCard size={16} color={colors.muted} />
              <Text style={styles.muted}>
                {payment}
                {order.paymentSource ? ` · ${titleCaseStatus(String(order.paymentSource))}` : ''}
              </Text>
            </View>
          ) : null}
        </AppCard>

        {order.notes ? (
          <>
            <SectionTitle title="Notes" />
            <AppCard>
              <Text style={styles.body}>{String(order.notes)}</Text>
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
                    <Text style={styles.historyStatus}>{titleCaseStatus(entry.status)}</Text>
                    {pickString(entry.note, entry.remarks) ? (
                      <Text style={styles.muted}>{pickString(entry.note, entry.remarks)}</Text>
                    ) : null}
                    <Text style={styles.historyTime}>
                      {formatDateTime(entry.createdAt || entry.created_at)}
                    </Text>
                  </View>
                </View>
              ))}
            </AppCard>
          </>
        ) : null}

        <SectionTitle title="Update status" />
        <AppCard style={styles.sectionCard}>
          <View style={styles.chips}>
            {ORDER_ACTIONS.map(item => (
              <Chip
                key={item}
                label={titleCaseStatus(item)}
                selected={action === item}
                onPress={() => setAction(item)}
              />
            ))}
          </View>
          <AppInput
            label="Note"
            value={note}
            onChangeText={setNote}
            placeholder="Preparing your order"
            optional
          />
          <AppButton title={`Send ${titleCaseStatus(action)}`} onPress={transition} loading={busy} />
        </AppCard>

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
  const status = item.orderItemStatus || item.status;

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
            {price ? <Text style={styles.lineTotal}>{formatCurrency(price * qty)}</Text> : null}
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
  payRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
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
  row2: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1, minWidth: 0 },
  // mt: { marginTop: 10 },
  pressed: { opacity: 0.72 },
});
