import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Minus, Plus, Trash2 } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { AppButton } from '@/components/ui/AppButton';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppInput } from '@/components/ui/AppInput';
import { Chip } from '@/components/ui/AppSwitchRow';
import { categoryService, foodService, productService } from '@/api/services';
import { FOOD_FULFILLMENT_TYPES } from '@/config/constants';
import type { FoodFulfillmentType } from '@/config/constants';
import { useToastStore } from '@/store/toastStore';
import { colors, radius } from '@/theme';
import { asArray, getErrorMessage, unwrapPayload } from '@/utils/apiHelpers';
import { formatCurrency, pickString } from '@/utils/format';
import { productIsSellable, productUnitPrice } from '@/utils/foodTables';
import type { Category, Product } from '@/types';

type CartLine = {
  key: string;
  productId: number | string;
  variantId?: number | string;
  name: string;
  unitPrice: number;
  quantity: number;
};

export function PosOrderScreen() {
  const showToast = useToastStore(s => s.show);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('ALL');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [fulfillmentType, setFulfillmentType] = useState<FoodFulfillmentType>('TAKEAWAY');
  const [busy, setBusy] = useState(false);

  const loadMenu = useCallback(async () => {
    try {
      const [productsRes, categoriesRes] = await Promise.all([
        productService.getMine({ limit: 100 }),
        categoryService.getAll(),
      ]);
      setProducts(asArray<Product>(unwrapPayload(productsRes.data)).filter(productIsSellable));
      setCategories(asArray<Category>(unwrapPayload(categoriesRes.data)));
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
    setCart(prev =>
      prev.map(line => (line.key === key ? { ...line, quantity } : line)).filter(line => line.quantity > 0),
    );
  };

  const cartTotal = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);

  const onSubmit = async () => {
    if (!cart.length) {
      showToast('Add at least one item', 'error');
      return;
    }
    setBusy(true);
    try {
      await foodService.createPosOrder({
        items: cart.map(line => ({
          productId: line.productId,
          quantity: line.quantity,
          ...(line.variantId != null ? { variantId: line.variantId } : {}),
        })),
        fulfillmentType,
      });
      showToast(
        fulfillmentType === 'DELIVERY' ? 'Delivery ticket created' : 'POS order created',
        'success',
      );
      setCart([]);
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not create POS order'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <AppHeader title="Counter POS" subtitle="Takeaway, dine-in or delivery ticket" showBack />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <Text style={styles.label}>Fulfillment</Text>
          <View style={styles.chips}>
            {FOOD_FULFILLMENT_TYPES.map(type => (
              <Chip
                key={type}
                label={type.replace('_', ' ')}
                selected={fulfillmentType === type}
                onPress={() => setFulfillmentType(type)}
              />
            ))}
          </View>
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
          {visibleProducts.map(product => {
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
          })}
        </View>

        {cart.length ? (
          <View style={styles.card}>
            <Text style={styles.heading}>Ticket</Text>
            {cart.map(line => (
              <View key={line.key} style={styles.cartRow}>
                <View style={styles.flex}>
                  <Text style={styles.menuName}>{line.name}</Text>
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
            <Text style={styles.total}>{formatCurrency(cartTotal)}</Text>
            <AppButton
              title={fulfillmentType === 'DELIVERY' ? 'Create delivery order' : 'Create POS order'}
              onPress={onSubmit}
              loading={busy}
            />
          </View>
        ) : null}
      </ScrollView>
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
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: 8,
  },
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
