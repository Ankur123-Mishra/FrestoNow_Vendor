import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Minus, Plus, Trash2 } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { AppButton } from '@/components/ui/AppButton';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppInput } from '@/components/ui/AppInput';
import { AppLoader } from '@/components/ui/AppLoader';
import { Chip } from '@/components/ui/AppSwitchRow';
import { categoryService, foodService, orderService, productService } from '@/api/services';
import { FOOD_PAYMENT_MODES } from '@/config/constants';
import type { FoodPaymentMode } from '@/config/constants';
import { useToastStore } from '@/store/toastStore';
import { colors, radius } from '@/theme';
import { asArray, getEntityId, getErrorMessage, unwrapPayload } from '@/utils/apiHelpers';
import { formatCurrency, pickString } from '@/utils/format';
import { productIsSellable, productUnitPrice, tableCode, tableStatusStyle } from '@/utils/foodTables';
import { getOrderItemName, getOrderItemQty, getOrderItems, getOrderTotal } from '@/utils/order';
import type {
  AppNavigation,
  Category,
  FoodFloor,
  FoodTable,
  Product,
  TableCheckRoute,
} from '@/types';

type CartLine = {
  key: string;
  productId: number | string;
  variantId?: number | string;
  name: string;
  unitPrice: number;
  quantity: number;
};

export function TableCheckScreen() {
  const route = useRoute<TableCheckRoute>();
  const navigation = useNavigation<AppNavigation>();
  const showToast = useToastStore(s => s.show);
  const tableId = route.params.tableId;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [table, setTable] = useState<FoodTable | null>(null);
  const [floorName, setFloorName] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('ALL');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [covers, setCovers] = useState('2');
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<FoodPaymentMode>('CASH');
  const [paymentReference, setPaymentReference] = useState('');

  const load = useCallback(async () => {
    try {
      const [floorsRes, productsRes, categoriesRes] = await Promise.all([
        foodService.getFloors(),
        productService.getMine({ limit: 100 }),
        categoryService.getAll(),
      ]);
      const floors = asArray<FoodFloor>(unwrapPayload(floorsRes.data));
      let found: FoodTable | null = null;
      let foundFloor = '';
      for (const floor of floors) {
        const match = asArray<FoodTable>(floor.tables).find(
          item => String(getEntityId(item)) === String(tableId),
        );
        if (match) {
          found = match;
          foundFloor = pickString(floor.name, 'Floor');
          break;
        }
      }
      setTable(found);
      setFloorName(foundFloor);
      setProducts(asArray<Product>(unwrapPayload(productsRes.data)).filter(productIsSellable));
      setCategories(asArray<Category>(unwrapPayload(categoriesRes.data)));
      const open = found?.openOrder;
      if (open) {
        setCovers(String(open.covers || 2));
        setGuestName(pickString(open.guestCustomer?.name, open.customerName));
        setGuestPhone(pickString(open.guestCustomer?.phone));
      }
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not load table'), 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast, tableId]);

  useEffect(() => {
    load();
  }, [load]);

  const status = String(table?.status || 'FREE').toUpperCase();
  const isOpenStatus = status === 'OCCUPIED' || status === 'BILLING';
  const isFreeStatus = status === 'FREE' || status === 'RESERVED';
  const openOrder = table?.openOrder ?? null;
  const style = tableStatusStyle(status);
  const code = table ? tableCode(table) : pickString(route.params.tableName, `Table ${tableId}`);

  const usedCategories = useMemo(() => {
    const ids = new Set(products.map(product => String(product.categoryId ?? '')));
    return categories.filter(category => ids.has(String(category.id)));
  }, [categories, products]);

  const visibleProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(product => {
      if (categoryId !== 'ALL' && String(product.categoryId) !== categoryId) {
        return false;
      }
      if (!q) {
        return true;
      }
      return pickString(product.name).toLowerCase().includes(q);
    });
  }, [categoryId, products, search]);

  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const cartTotal = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);

  const addProduct = (product: Product) => {
    const priced = productUnitPrice(product);
    if (!priced) {
      showToast('This item has no sellable variant', 'error');
      return;
    }
    const key = `${product.id}:${priced.variantId ?? ''}`;
    setCart(prev => {
      const existing = prev.find(line => line.key === key);
      if (existing) {
        return prev.map(line =>
          line.key === key ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }
      return [
        ...prev,
        {
          key,
          productId: product.id,
          variantId: priced.variantId,
          name: pickString(product.name, 'Item'),
          unitPrice: priced.price,
          quantity: 1,
        },
      ];
    });
  };

  const setQty = (key: string, quantity: number) => {
    setCart(prev => prev.map(line => (line.key === key ? { ...line, quantity } : line)).filter(line => line.quantity > 0));
  };

  const cartPayload = () =>
    cart.map(line => ({
      productId: line.productId,
      quantity: line.quantity,
      ...(line.variantId != null ? { variantId: line.variantId } : {}),
    }));

  const run = async (work: () => Promise<unknown>, success: string, after?: () => void) => {
    setBusy(true);
    try {
      await work();
      showToast(success, 'success');
      after?.();
      await load();
    } catch (error) {
      showToast(getErrorMessage(error, 'Action failed'), 'error');
      await load();
    } finally {
      setBusy(false);
    }
  };

  const onOpenCheck = () => {
    const name = guestName.trim();
    const phoneDigits = guestPhone.replace(/\D/g, '');
    if (!name) {
      showToast('Guest name is required', 'error');
      return;
    }
    if (phoneDigits.length < 10) {
      showToast('Guest phone (min 10 digits) is required', 'error');
      return;
    }
    if (!cart.length) {
      showToast('Add at least one item to open the check', 'error');
      return;
    }
    void run(
      () =>
        foodService.openCheck(tableId, {
          covers: Number(covers) || 1,
          guestName: name,
          guestPhone: guestPhone.trim(),
          version: table?.version,
          items: cartPayload(),
        }),
      'Check opened',
      () => setCart([]),
    );
  };

  const onAddItems = () => {
    if (!cart.length) {
      showToast('Add items first', 'error');
      return;
    }
    void run(
      () => foodService.addTableItems(tableId, cartPayload()),
      'Items sent to kitchen',
      () => setCart([]),
    );
  };

  const onSettle = () => {
    if (!openOrder) {
      return;
    }
    void run(
      () =>
        foodService.settleCheck(tableId, {
          paymentMethod,
          paymentReference: paymentReference.trim() || undefined,
          version: table?.version,
          orderId: openOrder.id,
        }),
      `Table ${code} settled`,
      () => navigation.goBack(),
    );
  };

  const onCancel = () => {
    Alert.alert(`Cancel open check on ${code}?`, 'This cannot be undone.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel check',
        style: 'destructive',
        onPress: () =>
          void run(
            () =>
              foodService.cancelCheck(tableId, {
                version: table?.version,
                reason: 'Cancelled from table POS',
              }),
            'Check cancelled',
            () => navigation.goBack(),
          ),
      },
    ]);
  };

  if (loading && !table) {
    return (
      <Screen>
        <AppLoader label="Loading table" />
      </Screen>
    );
  }

  const ticketItems = openOrder ? getOrderItems(openOrder) : [];

  return (
    <Screen>
      <AppHeader
        title={code}
        subtitle={`${floorName || 'Floor'}${table?.capacity ? ` · ${table.capacity} seats` : ''} · ${style.label}`}
        showBack
      />
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
        <View style={[styles.statusPill, { backgroundColor: style.bg, borderColor: style.border }]}>
          <Text style={[styles.statusText, { color: style.text }]}>{style.label}</Text>
          {openOrder ? (
            <Text style={styles.statusBill}>
              #{pickString(openOrder.orderNumber, openOrder.id)} · {formatCurrency(getOrderTotal(openOrder))}
            </Text>
          ) : (
            <Text style={styles.statusBill}>Tap items to open check</Text>
          )}
        </View>

        {status === 'CLEANING' ? (
          <View style={styles.card}>
            <Text style={styles.heading}>Needs cleaning</Text>
            <Text style={styles.meta}>Mark ready before the next guests can scan the QR.</Text>
            <AppButton
              title="Mark table ready"
              loading={busy}
              onPress={() =>
                void run(
                  () => foodService.markTableCleaned(tableId, { version: table?.version }),
                  `Table ${code} is ready`,
                )
              }
            />
          </View>
        ) : null}

        {isFreeStatus ? (
          <View style={styles.card}>
            <Text style={styles.heading}>Guest details</Text>
            <AppInput label="Guest name" value={guestName} onChangeText={setGuestName} placeholder="Name" />
            <AppInput
              label="Phone"
              value={guestPhone}
              onChangeText={setGuestPhone}
              keyboardType="phone-pad"
              placeholder="10-digit mobile"
            />
            <AppInput label="Covers" value={covers} onChangeText={setCovers} keyboardType="number-pad" />
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.heading}>Menu</Text>
          <AppInput label="Search" value={search} onChangeText={setSearch} placeholder="Search items" optional />
          <View style={styles.chips}>
            <Chip label="All" selected={categoryId === 'ALL'} onPress={() => setCategoryId('ALL')} />
            {usedCategories.map(category => (
              <Chip
                key={String(category.id)}
                label={pickString(category.name, String(category.id))}
                selected={categoryId === String(category.id)}
                onPress={() => setCategoryId(String(category.id))}
              />
            ))}
          </View>
          {visibleProducts.length === 0 ? (
            <Text style={styles.meta}>No menu items match.</Text>
          ) : (
            visibleProducts.map(product => {
              const priced = productUnitPrice(product);
              return (
                <Pressable key={String(product.id)} style={styles.menuRow} onPress={() => addProduct(product)}>
                  <View style={styles.flex}>
                    <Text style={styles.menuName}>{pickString(product.name, 'Item')}</Text>
                    <Text style={styles.meta}>{formatCurrency(priced?.price)}</Text>
                  </View>
                  <Plus size={18} color={colors.brand[700]} />
                </Pressable>
              );
            })
          )}
        </View>

        {cart.length ? (
          <View style={styles.card}>
            <Text style={styles.heading}>Ticket · {itemCount} items</Text>
            {cart.map(line => (
              <View key={line.key} style={styles.cartRow}>
                <View style={styles.flex}>
                  <Text style={styles.menuName}>{line.name}</Text>
                  <Text style={styles.meta}>{formatCurrency(line.unitPrice * line.quantity)}</Text>
                </View>
                <View style={styles.qtyRow}>
                  <Pressable onPress={() => setQty(line.key, line.quantity - 1)} style={styles.qtyBtn}>
                    {line.quantity === 1 ? <Trash2 size={14} color={colors.danger} /> : <Minus size={14} color={colors.text} />}
                  </Pressable>
                  <Text style={styles.qty}>{line.quantity}</Text>
                  <Pressable onPress={() => setQty(line.key, line.quantity + 1)} style={styles.qtyBtn}>
                    <Plus size={14} color={colors.text} />
                  </Pressable>
                </View>
              </View>
            ))}
            <Text style={styles.total}>Cart {formatCurrency(cartTotal)}</Text>
            {isFreeStatus ? (
              <AppButton title="Open check" loading={busy} onPress={onOpenCheck} />
            ) : (
              <AppButton title="Send to kitchen" loading={busy} onPress={onAddItems} />
            )}
          </View>
        ) : null}

        {isOpenStatus && openOrder ? (
          <View style={styles.card}>
            <Text style={styles.heading}>Open check</Text>
            {ticketItems.length ? (
              ticketItems.map((item, index) => (
                <View key={String(item.id ?? index)} style={styles.ticketRow}>
                  <Text style={styles.menuName}>
                    {getOrderItemQty(item)}× {getOrderItemName(item)}
                  </Text>
                  <Text style={styles.meta}>{titleCaseSafe(item.orderItemStatus)}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.meta}>No items on this check yet.</Text>
            )}
            <View style={styles.actionCol}>
              <AppButton
                title="Request bill"
                variant="outline"
                loading={busy}
                onPress={() =>
                  void run(
                    () => foodService.updateTable(tableId, { status: 'BILLING' }),
                    `${code} → billing`,
                  )
                }
              />
              <AppButton
                title="Mark served"
                variant="outline"
                loading={busy}
                onPress={() =>
                  void run(
                    () => orderService.transitionStatus(openOrder.id, 'SERVED'),
                    'Marked served',
                  )
                }
              />
              <AppButton title="Cancel check" variant="danger" loading={busy} onPress={onCancel} />
            </View>
            <Text style={styles.heading}>Settle</Text>
            <View style={styles.chips}>
              {FOOD_PAYMENT_MODES.map(mode => (
                <Chip
                  key={mode}
                  label={mode}
                  selected={paymentMethod === mode}
                  onPress={() => setPaymentMethod(mode)}
                />
              ))}
            </View>
            <AppInput
              label="Payment reference"
              value={paymentReference}
              onChangeText={setPaymentReference}
              placeholder="UPI / card ref"
              optional
            />
            <AppButton title="Settle check" loading={busy} onPress={onSettle} />
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function titleCaseSafe(value?: string | null) {
  const raw = String(value || '').replace(/_/g, ' ').toLowerCase();
  return raw ? raw.replace(/\b\w/g, char => char.toUpperCase()) : '';
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 32, gap: 12 },
  statusPill: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 12,
  },
  statusText: { fontWeight: '800', fontSize: 14 },
  statusBill: { marginTop: 4, fontWeight: '700', color: colors.text },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heading: { fontWeight: '800', fontSize: 16, color: colors.text, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: 8,
  },
  menuName: { fontWeight: '700', color: colors.text },
  meta: { color: colors.muted, fontSize: 12, fontWeight: '600', marginTop: 2 },
  flex: { flex: 1 },
  cartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qty: { fontWeight: '800', minWidth: 16, textAlign: 'center' },
  total: { fontWeight: '800', color: colors.brand[800], marginVertical: 8, fontSize: 15 },
  ticketRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  actionCol: { gap: 8, marginVertical: 10 },
});
