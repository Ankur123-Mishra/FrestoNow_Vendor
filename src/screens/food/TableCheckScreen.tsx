import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Minus, Plus, Trash2 } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { AddonPickerModal } from '@/components/food/AddonPickerModal';
import { PosMenuProductCard } from '@/components/food/PosMenuProductCard';
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
import { getPosMenuAvailability } from '@/utils/posMenuAvailability';
import {
  buildPosModifierGroups,
  cartLineKey,
  productShowsAddons,
  type AddonSelectionResult,
  type ModifierGroupRule,
} from '@/utils/posModifiers';
import {
  getOrderItemDisplayName,
  getOrderItemQty,
  getOrderItems,
  getOrderTotal,
} from '@/utils/order';
import type {
  AppNavigation,
  Category,
  FoodFloor,
  FoodModifierGroup,
  FoodTable,
  Order,
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
  modifierOptionIds: number[];
  addonLabels: string[];
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
  const [waiterName, setWaiterName] = useState('');
  const [discount, setDiscount] = useState('0');
  const [tipAmount, setTipAmount] = useState('0');
  const [serviceCharge, setServiceCharge] = useState('0');
  const [addonGroupsStore, setAddonGroupsStore] = useState<FoodModifierGroup[]>([]);
  const [addonProduct, setAddonProduct] = useState<Product | null>(null);
  const [addonGroups, setAddonGroups] = useState<ModifierGroupRule[]>([]);
  const [addonOpen, setAddonOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | number | null>(null);

  const load = useCallback(async () => {
    try {
      const [floorsRes, productsRes, categoriesRes, addonsRes] = await Promise.all([
        foodService.getFloors(),
        productService.getMine({ limit: 100 }),
        categoryService.getAll(),
        foodService.getModifierGroups(),
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
      setAddonGroupsStore(asArray<FoodModifierGroup>(unwrapPayload(addonsRes.data)));
      const open = found?.openOrder;
      if (open) {
        setCovers(String(open.covers || 2));
        setGuestName(pickString(open.guestCustomer?.name, open.customerName));
        setGuestPhone(pickString(open.guestCustomer?.phone));
        setWaiterName(pickString(open.waiterName));
        setDiscount(String(open.discount ?? 0));
        setTipAmount(String(open.tipAmount ?? 0));
        setServiceCharge(String(open.serviceCharge ?? 0));
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
  const baseOpenOrder = table?.openOrder ?? null;
  const sessionOrders = asArray<Order>(baseOpenOrder?.sessionOrders ?? table?.sessionOrders);
  const openOrder = useMemo(() => {
    if (!baseOpenOrder) {
      return null;
    }
    if (selectedOrderId && sessionOrders.length > 0) {
      return sessionOrders.find(order => String(order.id) === String(selectedOrderId)) || baseOpenOrder;
    }
    return baseOpenOrder;
  }, [baseOpenOrder, selectedOrderId, sessionOrders]);
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
    const avail = getPosMenuAvailability(product);
    if (avail.unavailable) {
      showToast(avail.stockLabel || 'Item unavailable', 'error');
      return;
    }
    const priced = productUnitPrice(product);
    if (!priced) {
      showToast('This item has no sellable variant', 'error');
      return;
    }
    const groups = buildPosModifierGroups(product, addonGroupsStore);
    if (groups.length > 0) {
      setAddonProduct(product);
      setAddonGroups(groups);
      setAddonOpen(true);
      return;
    }
    pushCartLine({
      productId: product.id,
      variantId: priced.variantId,
      name: pickString(product.name, 'Item'),
      unitPrice: priced.price,
      quantity: 1,
      modifierOptionIds: [],
      addonLabels: [],
    });
  };

  const pushCartLine = (line: Omit<CartLine, 'key'>) => {
    const key = cartLineKey(line.productId, line.variantId, line.modifierOptionIds);
    setCart(prev => {
      const existing = prev.find(item => item.key === key);
      if (existing) {
        return prev.map(item =>
          item.key === key ? { ...item, quantity: item.quantity + line.quantity } : item,
        );
      }
      return [...prev, { ...line, key }];
    });
  };

  const confirmAddon = (result: AddonSelectionResult) => {
    pushCartLine({
      productId: result.productId,
      variantId: result.variantId,
      name: result.name,
      unitPrice: result.unitPrice,
      quantity: result.quantity,
      modifierOptionIds: result.modifierOptionIds,
      addonLabels: result.addonLabels,
    });
    setAddonOpen(false);
    setAddonProduct(null);
    setAddonGroups([]);
  };

  const setQty = (key: string, quantity: number) => {
    setCart(prev => prev.map(line => (line.key === key ? { ...line, quantity } : line)).filter(line => line.quantity > 0));
  };

  const cartPayload = () =>
    cart.map(line => ({
      productId: line.productId,
      quantity: line.quantity,
      ...(line.variantId != null ? { variantId: line.variantId } : {}),
      ...(line.modifierOptionIds.length ? { modifierOptionIds: line.modifierOptionIds } : {}),
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
    void run(
      () =>
        foodService.openCheck(tableId, {
          covers: Number(covers) || 1,
          guestName: name,
          guestPhone: guestPhone.trim(),
          waiterName: waiterName.trim() || undefined,
          version: table?.version,
          items: cartPayload(),
        }),
      cart.length ? 'Check opened · kitchen notified' : 'Table seated (empty check)',
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
      'Batch sent to kitchen',
      () => setCart([]),
    );
  };

  const canVoidItem = (status?: string | null) => {
    const value = String(status || '').toUpperCase();
    return value === 'ORDERED' || value === 'PROCESSING';
  };

  const onVoidItem = (itemId: string | number, label: string) => {
    Alert.alert(`Void ${label}?`, 'Only works before the line is READY.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Void',
        style: 'destructive',
        onPress: () =>
          void run(
            () =>
              foodService.voidTableItem(tableId, itemId, {
                reason: 'Guest changed mind',
              }),
            'Line voided',
          ),
      },
    ]);
  };

  const onAdjustBill = () => {
    if (!openOrder) {
      return;
    }
    void run(
      () =>
        foodService.adjustBill(openOrder.id, {
          discount: Number(discount) || 0,
          discountType: 'FLAT',
          discountReason: Number(discount) > 0 ? 'Manager adjustment' : undefined,
          tipAmount: Number(tipAmount) || 0,
          serviceCharge: Number(serviceCharge) || 0,
        }),
      'Bill adjusted',
    );
  };

  const onAssignWaiter = () => {
    if (!waiterName.trim()) {
      showToast('Enter waiter name', 'error');
      return;
    }
    void run(
      () => foodService.assignWaiter(tableId, { waiterName: waiterName.trim() }),
      `Waiter → ${waiterName.trim()}`,
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
          orderId: selectedOrderId || openOrder.id,
          discount: Number(discount) || undefined,
          tipAmount: Number(tipAmount) || undefined,
          serviceCharge: Number(serviceCharge) || undefined,
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
            <AppInput
              label="Waiter"
              value={waiterName}
              onChangeText={setWaiterName}
              placeholder="Optional"
              optional
            />
            {!cart.length ? (
              <AppButton title="Open empty check" loading={busy} onPress={onOpenCheck} variant="outline" />
            ) : null}
          </View>
        ) : null}

        {isOpenStatus && (guestName || guestPhone) ? (
          <Text style={styles.guestOnCheck}>
            {[guestName, guestPhone].filter(Boolean).join(' · ')}
          </Text>
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
            <View style={styles.menuGrid}>
              {visibleProducts.map(product => (
                <PosMenuProductCard
                  key={String(product.id)}
                  product={product}
                  hasAddons={productShowsAddons(product, addonGroupsStore)}
                  onAdd={addProduct}
                />
              ))}
            </View>
          )}
        </View>

        {cart.length ? (
          <View style={styles.card}>
            <Text style={styles.heading}>To send · {itemCount} items</Text>
            {cart.map(line => (
              <View key={line.key} style={styles.cartRow}>
                <View style={styles.flex}>
                  <Text style={styles.menuName}>{isOpenStatus ? `+ ${line.name}` : line.name}</Text>
                  {line.addonLabels.length ? (
                    <Text style={styles.meta}>{line.addonLabels.join(' · ')}</Text>
                  ) : null}
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
            <Text style={styles.total}>Draft {formatCurrency(cartTotal)}</Text>
            {isFreeStatus ? (
              <AppButton title="Open check + send kitchen" loading={busy} onPress={onOpenCheck} />
            ) : isOpenStatus ? (
              <AppButton title="Send to kitchen" loading={busy} onPress={onAddItems} />
            ) : null}
          </View>
        ) : null}

        {isOpenStatus && openOrder ? (
          <View style={styles.card}>
            <Text style={styles.heading}>Open check</Text>
            <Text style={styles.meta}>
              Channel {pickString(openOrder.orderChannel, 'DINE_IN')} · pay{' '}
              {pickString(openOrder.paymentMode, 'OPEN_CHECK')} ·{' '}
              {pickString(openOrder.orderStatus, openOrder.status)}
            </Text>
            {sessionOrders.length > 1 ? (
              <View style={styles.chips}>
                <Chip
                  label="All merged"
                  selected={selectedOrderId == null}
                  onPress={() => setSelectedOrderId(null)}
                />
                {sessionOrders.map((order, idx) => (
                  <Chip
                    key={String(order.id ?? idx)}
                    label={`${pickString(order.guestCustomer?.name, `Guest ${idx + 1}`)} · ${formatCurrency(getOrderTotal(order))}`}
                    selected={String(selectedOrderId) === String(order.id)}
                    onPress={() => setSelectedOrderId(order.id)}
                  />
                ))}
              </View>
            ) : null}
            {ticketItems.length ? (
              ticketItems.map((item, index) => {
                const itemId = item.id;
                const voidable = itemId != null && canVoidItem(item.orderItemStatus);
                return (
                  <View key={String(itemId ?? index)} style={styles.ticketRow}>
                    <View style={styles.flex}>
                      <Text style={styles.menuName}>
                        {getOrderItemQty(item)}× {getOrderItemDisplayName(item)}
                      </Text>
                      <Text style={styles.meta}>{titleCaseSafe(item.orderItemStatus)}</Text>
                    </View>
                    {voidable ? (
                      <Pressable
                        onPress={() => onVoidItem(itemId, getOrderItemDisplayName(item))}
                        style={styles.voidBtn}
                        hitSlop={8}>
                        <Trash2 size={16} color={colors.danger} />
                      </Pressable>
                    ) : null}
                  </View>
                );
              })
            ) : (
              <Text style={styles.meta}>No items yet — add a batch below and send to kitchen.</Text>
            )}

            <Text style={styles.heading}>Waiter</Text>
            <AppInput
              label="Assigned waiter"
              value={waiterName}
              onChangeText={setWaiterName}
              placeholder="Name"
            />
            <AppButton title="Save waiter" variant="outline" loading={busy} onPress={onAssignWaiter} />

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

            <Text style={styles.heading}>Bill adjust</Text>
            <AppInput
              label="Discount (flat)"
              value={discount}
              onChangeText={setDiscount}
              keyboardType="decimal-pad"
              optional
            />
            <AppInput
              label="Tip"
              value={tipAmount}
              onChangeText={setTipAmount}
              keyboardType="decimal-pad"
              optional
            />
            <AppInput
              label="Service charge"
              value={serviceCharge}
              onChangeText={setServiceCharge}
              keyboardType="decimal-pad"
              optional
            />
            <AppButton title="Apply adjustments" variant="outline" loading={busy} onPress={onAdjustBill} />

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
            <AppButton title="Settle check → cleaning" loading={busy} onPress={onSettle} />
          </View>
        ) : null}
      </ScrollView>
      <AddonPickerModal
        open={addonOpen}
        product={addonProduct}
        groups={addonGroups}
        basePrice={addonProduct ? productUnitPrice(addonProduct)?.price ?? 0 : 0}
        variantId={addonProduct ? productUnitPrice(addonProduct)?.variantId : undefined}
        onClose={() => {
          setAddonOpen(false);
          setAddonProduct(null);
          setAddonGroups([]);
        }}
        onConfirm={confirmAddon}
      />
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
  guestOnCheck: { color: colors.muted, fontSize: 12, fontWeight: '700', marginTop: -4 },
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: 8,
  },
  voidBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionCol: { gap: 8, marginVertical: 10 },
});
