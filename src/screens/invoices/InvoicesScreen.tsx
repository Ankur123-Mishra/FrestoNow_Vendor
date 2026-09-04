import React, { useCallback, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { FileText, Printer, X } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { AppEmpty } from '@/components/ui/AppEmpty';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppLoader } from '@/components/ui/AppLoader';
import { counterService, orderService } from '@/api/services';
import { useToastStore } from '@/store/toastStore';
import { colors, radius } from '@/theme';
import { asArray, getEntityId, getErrorMessage, unwrapPayload } from '@/utils/apiHelpers';
import { formatCurrency, formatDateTime, pickString } from '@/utils/format';
import type { AppNavigation, Order } from '@/types';

type InvoiceFormat = 'html' | 'thermal';

type SelectedInvoice = {
  orderId: string | number;
  orderNumber?: string;
};

export function InvoicesScreen() {
  const navigation = useNavigation<AppNavigation>();
  const showToast = useToastStore(s => s.show);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selected, setSelected] = useState<SelectedInvoice | null>(null);

  const load = useCallback(async () => {
    try {
      let res;
      try {
        res = await counterService.listInvoices({ limit: 60 });
      } catch {
        res = await orderService.getAll({ limit: 60 });
      }
      setOrders(asArray<Order>(unwrapPayload(res.data)));
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not load invoices'), 'error');
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

  const openPreview = (invoice: SelectedInvoice, format: InvoiceFormat) => {
    setSelected(null);
    navigation.navigate('InvoicePreview', {
      orderId: invoice.orderId,
      format,
      orderNumber: invoice.orderNumber,
    });
  };

  if (loading && orders.length === 0) {
    return (
      <Screen>
        <AppLoader label="Loading invoices" />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader
        title="GST invoices"
        subtitle="Print A4 or 80mm like the vendor web"
        showBack
      />
      <FlatList
        data={orders}
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
          <AppEmpty
            icon={FileText}
            title="No invoices yet"
            subtitle="Completed orders will appear here for A4 / 80mm print."
          />
        }
        renderItem={({ item }) => {
          const id = getEntityId(item);
          const orderNumber = pickString(item.orderNumber, String(id || '—'));
          const customer = pickString(
            (item as { guestCustomer?: { name?: string } }).guestCustomer?.name,
            (item.user as { name?: string } | undefined)?.name,
            (item.customer as { name?: string } | undefined)?.name,
            'Walk-in',
          );
          const invoice: SelectedInvoice | null = id
            ? { orderId: id, orderNumber: pickString(item.orderNumber) || undefined }
            : null;

          return (
            <Pressable
              onPress={() => invoice && setSelected(invoice)}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
              <View style={styles.top}>
                <Text style={styles.title}>#{orderNumber}</Text>
                <Text style={styles.amount}>{formatCurrency(item.totalAmount ?? item.total)}</Text>
              </View>
              <Text style={styles.meta}>
                {customer} · {formatDateTime(item.createdAt)}
              </Text>
              <View style={styles.actions}>
                <Pressable
                  onPress={() => invoice && openPreview(invoice, 'html')}
                  style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}>
                  <Printer size={14} color={colors.brand[800]} />
                  <Text style={styles.actionText}>A4</Text>
                </Pressable>
                <Pressable
                  onPress={() => invoice && openPreview(invoice, 'thermal')}
                  style={({ pressed }) => [styles.actionBtn, styles.actionBtnAlt, pressed && styles.pressed]}>
                  <Printer size={14} color={colors.brand[800]} />
                  <Text style={styles.actionText}>80mm</Text>
                </Pressable>
              </View>
            </Pressable>
          );
        }}
      />

      <Modal
        visible={Boolean(selected)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelected(null)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.overlay} onPress={() => setSelected(null)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <View style={styles.sheetTitles}>
                <Text style={styles.sheetTitle}>Choose invoice format</Text>
                <Text style={styles.sheetSub}>
                  #{selected?.orderNumber || selected?.orderId} · same as website GST print
                </Text>
              </View>
              <Pressable onPress={() => setSelected(null)} hitSlop={10}>
                <X size={18} color={colors.textSecondary} />
              </Pressable>
            </View>
            <Pressable
              onPress={() => selected && openPreview(selected, 'html')}
              style={({ pressed }) => [styles.option, pressed && styles.pressed]}>
              <View style={styles.optionIcon}>
                <FileText size={18} color={colors.brand[700]} />
              </View>
              <View style={styles.optionCopy}>
                <Text style={styles.optionTitle}>A4</Text>
                <Text style={styles.optionSub}>Full GST tax invoice (A4)</Text>
              </View>
            </Pressable>
            <Pressable
              onPress={() => selected && openPreview(selected, 'thermal')}
              style={({ pressed }) => [styles.option, pressed && styles.pressed]}>
              <View style={styles.optionIcon}>
                <Printer size={18} color={colors.brand[700]} />
              </View>
              <View style={styles.optionCopy}>
                <Text style={styles.optionTitle}>80mm</Text>
                <Text style={styles.optionSub}>Thermal slip for 80mm printers</Text>
              </View>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  pressed: { opacity: 0.9 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  title: { fontWeight: '800', color: colors.text, fontSize: 15 },
  amount: { fontWeight: '800', color: colors.brand[800], fontSize: 15 },
  meta: { color: colors.muted, marginTop: 6, fontWeight: '600', fontSize: 12 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: colors.brand[50],
    borderWidth: 1,
    borderColor: colors.brand[100],
  },
  actionBtnAlt: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
  },
  actionText: { color: colors.brand[800], fontWeight: '700', fontSize: 13 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: 16,
    paddingBottom: 28,
    gap: 10,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: 12,
  },
  sheetTitles: { flex: 1 },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  sheetSub: { marginTop: 2, color: colors.muted, fontWeight: '600', fontSize: 12 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand[50],
  },
  optionCopy: { flex: 1 },
  optionTitle: { fontWeight: '800', color: colors.text, fontSize: 15 },
  optionSub: { marginTop: 2, color: colors.muted, fontWeight: '600', fontSize: 12 },
});
