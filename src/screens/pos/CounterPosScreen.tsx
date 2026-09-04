import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Minus, Plus, ShoppingCart } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { AppButton } from '@/components/ui/AppButton';
import { AppEmpty } from '@/components/ui/AppEmpty';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppInput } from '@/components/ui/AppInput';
import { AppLoader } from '@/components/ui/AppLoader';
import { Chip } from '@/components/ui/AppSwitchRow';
import { counterService, productService } from '@/api/services';
import { getModuleMeta } from '@/config/modules';
import { useModuleStore } from '@/store/moduleStore';
import { useToastStore } from '@/store/toastStore';
import { colors, radius } from '@/theme';
import { asArray, getEntityId, getErrorMessage, unwrapPayload } from '@/utils/apiHelpers';
import { formatCurrency, pickString } from '@/utils/format';
import type { Product } from '@/types';

type CartLine = {
  key: string;
  productId: string | number;
  variantId?: string | number;
  name: string;
  price: number;
  quantity: number;
};

const PAYMENTS = ['CASH', 'UPI', 'CARD'] as const;

export function CounterPosScreen() {
  const showToast = useToastStore(s => s.show);
  const activeModule = useModuleStore(s => s.activeModule);
  const meta = getModuleMeta(activeModule);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [barcode, setBarcode] = useState('');
  const [discount, setDiscount] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState<(typeof PAYMENTS)[number]>('CASH');

  const load = useCallback(async () => {
    try {
      const res = await productService.getMine({ limit: 100 });
      setProducts(asArray<Product>(unwrapPayload(res.data)));
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not load products'), 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const addProduct = (product: Product) => {
    const productId = getEntityId(product);
    if (!productId) {
      return;
    }
    const variant = Array.isArray(product.variants) ? product.variants[0] : undefined;
    const variantId = variant ? getEntityId(variant) : undefined;
    const price = Number(
      (variant as { sellingprice?: number; sellingPrice?: number; price?: number } | undefined)
        ?.sellingprice ??
        (variant as { sellingPrice?: number } | undefined)?.sellingPrice ??
        (variant as { price?: number } | undefined)?.price ??
        product.sellingPrice ??
        product.price ??
        0,
    );
    const key = `${productId}:${variantId || 'base'}`;
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
          productId,
          variantId: variantId || undefined,
          name: pickString(product.name, 'Item'),
          price,
          quantity: 1,
        },
      ];
    });
  };

  const changeQty = (key: string, delta: number) => {
    setCart(prev =>
      prev
        .map(line => (line.key === key ? { ...line, quantity: line.quantity + delta } : line))
        .filter(line => line.quantity > 0),
    );
  };

  const subtotal = useMemo(
    () => cart.reduce((sum, line) => sum + line.price * line.quantity, 0),
    [cart],
  );
  const discountValue = Number(discount) || 0;
  const total = Math.max(0, subtotal - discountValue);

  const onLookup = async () => {
    if (!barcode.trim()) {
      return;
    }
    try {
      const res = await counterService.lookupVariant(barcode.trim());
      const data = unwrapPayload(res.data) as {
        product?: Product;
        variantId?: string | number;
      };
      if (data?.product) {
        addProduct({
          ...data.product,
          variants: data.variantId
            ? [{ ...(data.product.variants?.[0] || {}), id: data.variantId }]
            : data.product.variants,
        } as Product);
        setBarcode('');
        showToast('Item added', 'success');
      } else {
        showToast('No product found for that code', 'error');
      }
    } catch (error) {
      showToast(getErrorMessage(error, 'Lookup failed'), 'error');
    }
  };

  const onCharge = async () => {
    if (!cart.length) {
      showToast('Add at least one item', 'error');
      return;
    }
    setSaving(true);
    try {
      await counterService.createInvoice({
        moduleType: activeModule,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        paymentMethod,
        discount: discountValue || undefined,
        idempotencyKey: `pos-${Date.now()}`,
        items: cart.map(line => ({
          productId: line.productId,
          variantId: line.variantId,
          quantity: line.quantity,
        })),
      });
      showToast('Invoice created', 'success');
      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      setDiscount('0');
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not create invoice'), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <AppLoader label="Loading counter POS" />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader title="Counter POS" subtitle={`${meta.label} walk-in billing`} showBack />
      <View style={styles.form}>
        <AppInput
          label="Scan / barcode"
          value={barcode}
          onChangeText={setBarcode}
          placeholder="SKU or barcode"
          onSubmitEditing={onLookup}
          returnKeyType="search"
        />
        <AppButton title="Lookup code" variant="outline" onPress={onLookup} />
        <AppInput label="Customer name" value={customerName} onChangeText={setCustomerName} optional />
        <AppInput
          label="Customer phone"
          value={customerPhone}
          onChangeText={setCustomerPhone}
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
        <View style={styles.chips}>
          {PAYMENTS.map(method => (
            <Chip
              key={method}
              label={method}
              selected={paymentMethod === method}
              onPress={() => setPaymentMethod(method)}
            />
          ))}
        </View>
      </View>

      <Text style={styles.section}>Catalog</Text>
      <FlatList
        data={products}
        keyExtractor={(item, index) => String(getEntityId(item) ?? index)}
        style={styles.catalog}
        ListEmptyComponent={<AppEmpty icon={ShoppingCart} title="No products" subtitle="Add catalog items first." />}
        renderItem={({ item }) => (
          <Pressable onPress={() => addProduct(item)} style={styles.productRow}>
            <Text style={styles.productName} numberOfLines={1}>
              {pickString(item.name, 'Product')}
            </Text>
            <Text style={styles.productPrice}>
              {formatCurrency(
                (item.variants?.[0] as { sellingprice?: number; sellingPrice?: number } | undefined)
                  ?.sellingprice ??
                  (item.variants?.[0] as { sellingPrice?: number } | undefined)?.sellingPrice ??
                  item.sellingPrice ??
                  item.price ??
                  0,
              )}
            </Text>
          </Pressable>
        )}
      />

      <View style={styles.cartBox}>
        <Text style={styles.section}>Cart ({cart.length})</Text>
        {cart.map(line => (
          <View key={line.key} style={styles.cartRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.productName} numberOfLines={1}>
                {line.name}
              </Text>
              <Text style={styles.meta}>{formatCurrency(line.price)}</Text>
            </View>
            <Pressable onPress={() => changeQty(line.key, -1)} style={styles.qtyBtn}>
              <Minus size={16} color={colors.brand[700]} />
            </Pressable>
            <Text style={styles.qty}>{line.quantity}</Text>
            <Pressable onPress={() => changeQty(line.key, 1)} style={styles.qtyBtn}>
              <Plus size={16} color={colors.brand[700]} />
            </Pressable>
          </View>
        ))}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatCurrency(total)}</Text>
        </View>
        <AppButton title="Charge & create invoice" onPress={onCharge} loading={saving} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  section: { fontWeight: '800', color: colors.text, marginBottom: 8, fontSize: 14 },
  catalog: { maxHeight: 180, marginBottom: 8 },
  productRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  productName: { fontWeight: '700', color: colors.text, flex: 1, marginRight: 8 },
  productPrice: { fontWeight: '800', color: colors.brand[800] },
  cartBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  cartRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  meta: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.brand[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  qty: { fontWeight: '800', color: colors.text, minWidth: 18, textAlign: 'center' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 10,
  },
  totalLabel: { fontWeight: '700', color: colors.textSecondary },
  totalValue: { fontWeight: '800', color: colors.brand[800], fontSize: 18 },
});
