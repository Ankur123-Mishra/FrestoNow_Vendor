import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Minus, Plus, Trash2 } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { AddonPickerModal } from '@/components/food/AddonPickerModal';
import { PosMenuProductCard } from '@/components/food/PosMenuProductCard';
import { AppButton } from '@/components/ui/AppButton';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppInput } from '@/components/ui/AppInput';
import { Chip } from '@/components/ui/AppSwitchRow';
import { categoryService, foodService, productService } from '@/api/services';
import { FOOD_PAYMENT_MODES, FOOD_POS_CHANNELS } from '@/config/constants';
import type { FoodPaymentMode, FoodPosChannel } from '@/config/constants';
import { useToastStore } from '@/store/toastStore';
import { colors, radius } from '@/theme';
import { asArray, getErrorMessage, unwrapPayload } from '@/utils/apiHelpers';
import { formatCurrency, pickString } from '@/utils/format';
import { productIsSellable, productUnitPrice } from '@/utils/foodTables';
import { getPosMenuAvailability } from '@/utils/posMenuAvailability';
import {
  buildPosModifierGroups,
  cartLineKey,
  productShowsAddons,
  type AddonSelectionResult,
  type ModifierGroupRule,
} from '@/utils/posModifiers';
import type { AppNavigation, Category, FoodModifierGroup, Product } from '@/types';

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

export function PosOrderScreen() {
  const navigation = useNavigation<AppNavigation>();
  const showToast = useToastStore(s => s.show);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('ALL');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [orderChannel, setOrderChannel] = useState<FoodPosChannel>('TAKEAWAY');
  const [paymentMethod, setPaymentMethod] = useState<FoodPaymentMode>('CASH');
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [discount, setDiscount] = useState('0');
  const [tipAmount, setTipAmount] = useState('0');
  const [busy, setBusy] = useState(false);
  const [addonGroupsStore, setAddonGroupsStore] = useState<FoodModifierGroup[]>([]);
  const [addonProduct, setAddonProduct] = useState<Product | null>(null);
  const [addonGroups, setAddonGroups] = useState<ModifierGroupRule[]>([]);
  const [addonOpen, setAddonOpen] = useState(false);

  const loadMenu = useCallback(async () => {
    try {
      const [productsRes, categoriesRes, addonsRes] = await Promise.all([
        productService.getMine({ limit: 100 }),
        categoryService.getAll(),
        foodService.getModifierGroups(),
      ]);
      setProducts(asArray<Product>(unwrapPayload(productsRes.data)).filter(productIsSellable));
      setCategories(asArray<Category>(unwrapPayload(categoriesRes.data)));
      setAddonGroupsStore(asArray<FoodModifierGroup>(unwrapPayload(addonsRes.data)));
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not load menu'), 'error');
    }
  }, [showToast]);

  useFocusEffect(
    useCallback(() => {
      loadMenu();
    }, [loadMenu]),
  );

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
    setCart(prev =>
      prev.map(line => (line.key === key ? { ...line, quantity } : line)).filter(line => line.quantity > 0),
    );
  };

  const cartTotal = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const payable = Math.max(0, cartTotal - (Number(discount) || 0) + (Number(tipAmount) || 0));

  const onSubmit = async () => {
    if (!cart.length) {
      showToast('Add at least one item', 'error');
      return;
    }
    setBusy(true);
    try {
      const res = await foodService.createPosOrder({
        items: cart.map(line => ({
          productId: line.productId,
          quantity: line.quantity,
          ...(line.variantId != null ? { variantId: line.variantId } : {}),
          ...(line.modifierOptionIds.length ? { modifierOptionIds: line.modifierOptionIds } : {}),
        })),
        orderChannel,
        paymentMethod,
        guestName: guestName.trim() || undefined,
        guestPhone: guestPhone.trim() || undefined,
        discount: Number(discount) || undefined,
        tipAmount: Number(tipAmount) || undefined,
        payments: [{ method: paymentMethod, amount: payable }],
      });
      const payload = unwrapPayload(res.data) as {
        order?: { id?: number | string; tokenNumber?: number | string | null };
        tokenNumber?: number | string | null;
      } | null;
      const order = (payload as { order?: { id?: number | string; tokenNumber?: number | string | null } })
        ?.order;
      const token = order?.tokenNumber ?? (payload as { tokenNumber?: number | string })?.tokenNumber;
      const orderId = order?.id;
      showToast(
        token != null ? `POS order created · Token #${token}` : 'POS order created · kitchen notified',
        'success',
      );
      setCart([]);
      setGuestName('');
      setGuestPhone('');
      setDiscount('0');
      setTipAmount('0');
      if (orderId != null) {
        Alert.alert(
          token != null ? `Token #${token}` : 'Order created',
          'Kitchen will ACCEPT → READY → COLLECT.',
          [
            { text: 'Stay', style: 'cancel' },
            {
              text: 'Open kitchen ticket',
              onPress: () => navigation.navigate('KitchenOrderDetail', { orderId }),
            },
          ],
        );
      }
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not create POS order'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <AppHeader title="Counter POS" subtitle="Takeaway / self-pickup · paid on create" showBack />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <Text style={styles.label}>Channel</Text>
          <View style={styles.chips}>
            {FOOD_POS_CHANNELS.map(channel => (
              <Chip
                key={channel}
                label={channel === 'SELF_PICKUP' ? 'Self pickup' : 'Takeaway'}
                selected={orderChannel === channel}
                onPress={() => setOrderChannel(channel)}
              />
            ))}
          </View>
          <Text style={styles.label}>Payment</Text>
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
          <AppInput label="Guest name" value={guestName} onChangeText={setGuestName} optional />
          <AppInput
            label="Guest phone"
            value={guestPhone}
            onChangeText={setGuestPhone}
            keyboardType="phone-pad"
            optional
          />
          <AppInput
            label="Discount"
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
          <AppInput label="Search menu" value={search} onChangeText={setSearch} placeholder="Search items" optional />
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
        </View>

        {cart.length ? (
          <View style={styles.card}>
            <Text style={styles.heading}>Ticket</Text>
            {cart.map(line => (
              <View key={line.key} style={styles.cartRow}>
                <View style={styles.flex}>
                  <Text style={styles.menuName}>{line.name}</Text>
                  {line.addonLabels.length ? (
                    <Text style={styles.meta}>{line.addonLabels.join(' · ')}</Text>
                  ) : null}
                  <Text style={styles.meta}>{formatCurrency(line.unitPrice * line.quantity)}</Text>
                </View>
                <View style={styles.qtyRow}>
                  <Pressable onPress={() => setQty(line.key, line.quantity - 1)} style={styles.qtyBtn}>
                    {line.quantity === 1 ? (
                      <Trash2 size={14} color={colors.danger} />
                    ) : (
                      <Minus size={14} color={colors.text} />
                    )}
                  </Pressable>
                  <Text style={styles.qty}>{line.quantity}</Text>
                  <Pressable onPress={() => setQty(line.key, line.quantity + 1)} style={styles.qtyBtn}>
                    <Plus size={14} color={colors.text} />
                  </Pressable>
                </View>
              </View>
            ))}
            <Text style={styles.total}>Pay {formatCurrency(payable)}</Text>
            <AppButton title="Pay & send to kitchen" onPress={onSubmit} loading={busy} />
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

const styles = StyleSheet.create({
  scroll: { paddingBottom: 32, gap: 12 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  label: { fontWeight: '700', color: colors.textSecondary, marginBottom: 8 },
  heading: { fontWeight: '800', fontSize: 16, color: colors.text, marginBottom: 8 },
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  menuName: { fontWeight: '700', color: colors.text },
  meta: { color: colors.muted, marginTop: 2, fontWeight: '600', fontSize: 12 },
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
});
