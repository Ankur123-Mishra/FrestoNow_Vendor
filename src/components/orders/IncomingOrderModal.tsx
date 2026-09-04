import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Volume2, VolumeX, X, UtensilsCrossed } from 'lucide-react-native';
import { AppButton } from '@/components/ui/AppButton';
import { Chip } from '@/components/ui/AppSwitchRow';
import { FOOD_PREP_PRESETS } from '@/config/constants';
import { colors, radius } from '@/theme';
import { formatCurrency, pickNumber, pickString } from '@/utils/format';
import {
  getOrderCustomerName,
  getOrderItemAddonLabels,
  getOrderItemName,
  getOrderItemPrice,
  getOrderItemQty,
  getOrderItems,
  getOrderTotal,
} from '@/utils/order';
import {
  acceptRemainingSeconds,
  formatMmSs,
  isDineInChannel,
  isPickupChannel,
  orderChannelLabel,
} from '@/utils/orderActions';
import { moderateScale } from '@/utils/responsive';
import type { Order } from '@/types';

type Props = {
  order: Order | null;
  queueCount: number;
  shopName: string;
  reason?: string;
  muted: boolean;
  busy?: boolean;
  error?: string | null;
  onMuteToggle: () => void;
  onDismiss: () => void;
  onAccept: (prepMins: number) => void;
  onReject: (reason: string) => void;
};

function channelRibbon(channel?: string | null, paymentSource?: string | null) {
  const key = String(channel || 'ONLINE_DELIVERY').toUpperCase();
  const source = String(paymentSource || '').toUpperCase();
  if (key === 'TAKEAWAY' && source === 'QR') {
    return 'PACKING';
  }
  if (isDineInChannel(channel)) {
    return key === 'QR_TABLE_ORDER' ? 'DINING' : 'DINE-IN';
  }
  if (isPickupChannel(channel)) {
    return orderChannelLabel(channel).toUpperCase();
  }
  return (
    {
      ONLINE_DELIVERY: 'ONLINE DELIVERY',
      DELIVERY: 'ONLINE DELIVERY',
      TAKEAWAY: 'TAKEAWAY',
      SELF_PICKUP: 'SELF PICKUP',
    }[key] ?? key.replace(/_/g, ' ')
  );
}

function orderShortId(order: Order) {
  if (order.tokenNumber != null) {
    return String(order.tokenNumber).padStart(4, '0').slice(-4);
  }
  const num = String(order.orderNumber ?? order.id);
  return num.slice(-4);
}

function formatClock(value?: string | null) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isPaidOrder(order: Order) {
  const mode = String(order.paymentMode || '').toUpperCase();
  const source = String(order.paymentSource || '').toUpperCase();
  return (
    Boolean(order.paymentOrderId) ||
    mode.includes('PAID') ||
    source === 'ONLINE' ||
    source === 'RAZORPAY' ||
    source === 'UPI'
  );
}

export function IncomingOrderModal({
  order,
  queueCount,
  shopName,
  reason,
  muted,
  busy,
  error,
  onMuteToggle,
  onDismiss,
  onAccept,
  onReject,
}: Props) {
  const [now, setNow] = useState(Date.now());
  const [prepMins, setPrepMins] = useState(20);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [billOpen, setBillOpen] = useState(false);

  useEffect(() => {
    setRejectOpen(false);
    setRejectReason('');
    setPrepMins(20);
    setBillOpen(false);
  }, [order?.id]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const remaining = order
    ? acceptRemainingSeconds(pickString(order.createdAt, order.created_at), now)
    : 5 * 60;
  const guest = order ? getOrderCustomerName(order) : '';
  const items = order ? getOrderItems(order) : [];
  const itemCount = items.length;
  const subtotal = items.reduce(
    (sum, item) => sum + getOrderItemPrice(item) * getOrderItemQty(item),
    0,
  );
  const title =
    reason === 'items_added'
      ? queueCount > 1
        ? `${queueCount} updates`
        : 'Items added'
      : queueCount > 1
        ? `${queueCount} new orders`
        : '1 new order';

  const tableLabel = order?.tableNumber
    ? `Table ${order.tableNumber}`
    : order?.tokenNumber != null
      ? `Token #${order.tokenNumber}`
      : null;

  const billRows = useMemo(() => {
    if (!order) {
      return [] as Array<{ label: string; value: string; tone?: 'neg' }>;
    }
    const rows: Array<{ label: string; value: string; tone?: 'neg' }> = [
      {
        label: `${itemCount} item${itemCount === 1 ? '' : 's'}`,
        value: formatCurrency(subtotal),
      },
    ];
    if (pickNumber(order.packagingFee) > 0) {
      rows.push({
        label: 'Restaurant packaging charges',
        value: formatCurrency(order.packagingFee),
      });
    }
    if (pickNumber(order.platformFee) > 0) {
      rows.push({ label: 'Platform fee', value: formatCurrency(order.platformFee) });
    }
    if (pickNumber(order.gst) > 0) {
      rows.push({ label: 'GST', value: formatCurrency(order.gst) });
    }
    if (pickNumber(order.discount) > 0) {
      rows.push({
        label: 'Discount',
        value: `-${formatCurrency(order.discount)}`,
        tone: 'neg',
      });
    }
    if (billOpen && pickNumber(order.deliveryFee) > 0) {
      rows.push({ label: 'Delivery fee', value: formatCurrency(order.deliveryFee) });
    }
    if (billOpen) {
      rows.push({ label: 'Total bill', value: formatCurrency(getOrderTotal(order)) });
    }
    return rows;
  }, [billOpen, itemCount, order, subtotal]);

  return (
    <Modal visible animationType="fade" transparent statusBarTranslucent onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.head}>
            <Text style={styles.title}>{title}</Text>
            <View style={styles.headActions}>
              <Pressable onPress={onMuteToggle} style={styles.muteBtn} hitSlop={8}>
                {muted ? (
                  <VolumeX size={16} color={colors.muted} />
                ) : (
                  <Volume2 size={16} color={colors.brand[700]} />
                )}
                <Text style={styles.muteText}>{muted ? 'Unmute' : 'Mute'}</Text>
              </Pressable>
              <Pressable onPress={onDismiss} hitSlop={10} style={styles.closeBtn}>
                <X size={18} color={colors.text} />
              </Pressable>
            </View>
          </View>

          <View style={styles.ribbon}>
            <Text style={styles.ribbonText}>
              {channelRibbon(order?.orderChannel, order?.paymentSource)}
              {tableLabel ? ` · ${tableLabel}` : ''}
            </Text>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled">
            <View style={styles.store}>
              <Text style={styles.shopName}>{shopName || 'Restaurant'}</Text>
              <Text style={styles.idRow}>
                ID: {order ? orderShortId(order) : '—'}
                {order
                  ? ` | ${formatClock(pickString(order.createdAt, order.created_at))}`
                  : ''}
              </Text>
              {guest ? <Text style={styles.guest}>Order by {guest}</Text> : null}
            </View>

            {order?.notes ? (
              <View style={styles.note}>
                <UtensilsCrossed size={16} color={colors.brand[700]} />
                <Text style={styles.noteText}>{order.notes}</Text>
              </View>
            ) : null}

            {!order ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={colors.brand[600]} />
                <Text style={styles.muted}>Loading order details…</Text>
              </View>
            ) : (
              <View style={styles.items}>
                {items.map(item => {
                  const addons = getOrderItemAddonLabels(item);
                  return (
                    <View key={String(item.id)} style={styles.itemRow}>
                      <View style={styles.itemMain}>
                        <Text style={styles.itemName}>
                          {getOrderItemQty(item)} × {getOrderItemName(item)}
                        </Text>
                        {addons.length ? (
                          <Text style={styles.itemOpts}>{addons.join(', ')}</Text>
                        ) : null}
                      </View>
                      <Text style={styles.itemPrice}>
                        {formatCurrency(getOrderItemPrice(item) * getOrderItemQty(item))}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}

            {order ? (
              <View style={styles.bill}>
                {billRows.map(row => (
                  <View key={row.label} style={styles.billRow}>
                    <Text style={[styles.billLabel, row.tone === 'neg' && styles.neg]}>
                      {row.label}
                    </Text>
                    <Text style={[styles.billValue, row.tone === 'neg' && styles.neg]}>
                      {row.value}
                    </Text>
                  </View>
                ))}
                <Pressable onPress={() => setBillOpen(v => !v)}>
                  <Text style={styles.moreLink}>
                    {billOpen ? 'Hide details' : 'View more details'}
                  </Text>
                </Pressable>
                <View style={[styles.paidBox, !isPaidOrder(order) && styles.dueBox]}>
                  <Text style={[styles.paidText, !isPaidOrder(order) && styles.dueText]}>
                    {isPaidOrder(order) ? 'PAID' : 'DUE'}
                    {order.paymentMode ? ` (${order.paymentMode})` : ''} ·{' '}
                    {formatCurrency(getOrderTotal(order))}
                  </Text>
                </View>
              </View>
            ) : null}

            <View style={styles.prep}>
              <Text style={styles.muted}>Prep time</Text>
              <View style={styles.prepChips}>
                {FOOD_PREP_PRESETS.map(mins => (
                  <Chip
                    key={mins}
                    label={`${mins} min`}
                    selected={prepMins === mins}
                    onPress={() => setPrepMins(mins)}
                  />
                ))}
              </View>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            {rejectOpen ? (
              <View style={styles.rejectBox}>
                <Text style={styles.rejectLabel}>Reject reason</Text>
                <TextInput
                  style={styles.rejectInput}
                  value={rejectReason}
                  onChangeText={setRejectReason}
                  placeholder="Item out of stock, kitchen closed…"
                  placeholderTextColor={colors.muted}
                  multiline
                  numberOfLines={2}
                />
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            {rejectOpen ? (
              <>
                <AppButton
                  title="Back"
                  variant="outline"
                  disabled={busy}
                  onPress={() => setRejectOpen(false)}
                  style={styles.footerBtn}
                />
                <AppButton
                  title={busy ? 'Rejecting…' : 'Confirm reject'}
                  variant="danger"
                  loading={busy}
                  disabled={busy || !rejectReason.trim() || !order}
                  onPress={() => onReject(rejectReason.trim())}
                  style={styles.footerBtn}
                />
              </>
            ) : (
              <>
                <AppButton
                  title="Reject"
                  variant="danger"
                  disabled={busy || !order}
                  onPress={() => setRejectOpen(true)}
                  style={styles.footerBtn}
                />
                <AppButton
                  title={busy ? 'Accepting…' : `Accept (${formatMmSs(remaining)})`}
                  loading={busy}
                  disabled={busy || !order}
                  onPress={() => onAccept(prepMins)}
                  style={styles.footerBtn}
                />
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    maxHeight: '92%',
    overflow: 'hidden',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
  },
  title: {
    flex: 1,
    fontSize: moderateScale(18),
    fontWeight: '800',
    color: colors.text,
    paddingRight: 8,
  },
  headActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  muteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
  },
  muteText: { color: colors.textSecondary, fontWeight: '700', fontSize: 12 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  ribbon: {
    backgroundColor: colors.brand[700],
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  ribbonText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.4,
  },
  body: { flexGrow: 0 },
  bodyContent: { padding: 16, paddingBottom: 8, gap: 12 },
  store: { gap: 4 },
  shopName: { fontSize: moderateScale(16), fontWeight: '800', color: colors.text },
  idRow: { color: colors.muted, fontSize: 13 },
  guest: { color: colors.textSecondary, fontWeight: '600', fontSize: 13 },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    padding: 10,
  },
  noteText: { flex: 1, color: colors.textSecondary, fontWeight: '600' },
  loadingBox: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  muted: { color: colors.muted, fontWeight: '600' },
  items: { gap: 10 },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingBottom: 8,
  },
  itemMain: { flex: 1 },
  itemName: { color: colors.text, fontWeight: '700' },
  itemOpts: { color: colors.muted, fontSize: 12, marginTop: 2 },
  itemPrice: { color: colors.textSecondary, fontWeight: '700' },
  bill: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: 12,
    gap: 6,
  },
  billRow: { flexDirection: 'row', justifyContent: 'space-between' },
  billLabel: { color: colors.textSecondary },
  billValue: { color: colors.text, fontWeight: '700' },
  neg: { color: colors.danger },
  moreLink: {
    color: colors.brand[700],
    fontWeight: '700',
    marginTop: 4,
    fontSize: 13,
  },
  paidBox: {
    marginTop: 6,
    backgroundColor: colors.successSoft,
    borderRadius: radius.sm,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  dueBox: { backgroundColor: colors.warningSoft },
  paidText: { color: colors.success, fontWeight: '800', fontSize: 13 },
  dueText: { color: colors.warning },
  prep: { gap: 8 },
  prepChips: { flexDirection: 'row', flexWrap: 'wrap' },
  error: { color: colors.danger, fontWeight: '600' },
  rejectBox: { gap: 6 },
  rejectLabel: { color: colors.textSecondary, fontWeight: '700' },
  rejectInput: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    padding: 12,
    color: colors.text,
    textAlignVertical: 'top',
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  footerBtn: { flex: 1 },
});
