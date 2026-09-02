import React, { useCallback, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { AlertTriangle, IndianRupee, Minus, Package, Plus, RotateCcw } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { AppBadge } from '@/components/ui/AppBadge';
import { AppButton } from '@/components/ui/AppButton';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppInput } from '@/components/ui/AppInput';
import { AppLoader } from '@/components/ui/AppLoader';
import { Chip } from '@/components/ui/AppSwitchRow';
import { inventoryService } from '@/api/services';
import { useToastStore } from '@/store/toastStore';
import { colors, radius, shadows } from '@/theme';
import { asArray, getErrorMessage, unwrapPayload } from '@/utils/apiHelpers';
import { formatCurrency, pickNumber, pickString, titleCaseStatus } from '@/utils/format';
import { resolveMediaUrl } from '@/utils/media';
import { moderateScale } from '@/utils/responsive';
import type { AppNavigation, InventoryEditRoute, InventoryItem } from '@/types';

const STOCK_STEPS = [1, 5, 10, 25];

function getVariantId(item: InventoryItem) {
  return item.variantId ?? item.id;
}

function parseQty(value: string) {
  const n = Number(value);
  if (!value.trim() || Number.isNaN(n) || n < 0) {
    return 0;
  }
  return Math.floor(n);
}

export function InventoryEditScreen() {
  const navigation = useNavigation<AppNavigation>();
  const { params } = useRoute<InventoryEditRoute>();
  const showToast = useToastStore(s => s.show);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [stock, setStock] = useState('0');
  const [price, setPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [lowStockAt, setLowStockAt] = useState('');
  const [continueSelling, setContinueSelling] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await inventoryService.getAll();
      const items = asArray<InventoryItem>(unwrapPayload(res.data));
      const match = items.find(row => String(getVariantId(row)) === String(params.inventoryId));
      if (!match) {
        showToast('Inventory item not found', 'error');
        return;
      }
      setItem(match);
      setStock(String(match.stock ?? 0));
      setPrice(match.price != null ? String(match.price) : '');
      setSellingPrice(match.sellingPrice != null ? String(match.sellingPrice) : '');
      setLowStockAt(match.lowStockAt != null ? String(match.lowStockAt) : '');
      setContinueSelling(Boolean(match.continueSellingWhenOos));
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not load inventory item'), 'error');
    } finally {
      setLoading(false);
    }
  }, [params.inventoryId, showToast]);

  React.useEffect(() => {
    load();
  }, [load]);

  const onSubmit = async () => {
    setSaving(true);
    try {
      await inventoryService.update(params.inventoryId, {
        stock: Number(stock) || 0,
        price: Number(price) || 0,
        sellingPrice: Number(sellingPrice) || 0,
        lowStockAt: Number(lowStockAt) || 0,
        continueSellingWhenOos: continueSelling,
      });
      showToast('Inventory updated', 'success');
      navigation.goBack();
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not update inventory'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const originalStock = pickNumber(item?.stock);
  const nextStock = parseQty(stock);
  const threshold = Number(lowStockAt);
  const hasThreshold = lowStockAt.trim() !== '' && !Number.isNaN(threshold);
  const outOfStock = nextStock <= 0;
  const lowStock = !outOfStock && hasThreshold && nextStock <= threshold;
  const stockDelta = nextStock - originalStock;

  const stockTone = outOfStock
    ? { bg: colors.dangerSoft, fg: colors.danger, label: 'Out of stock' }
    : lowStock
      ? { bg: colors.warningSoft, fg: colors.warning, label: 'Low stock' }
      : { bg: colors.successSoft, fg: colors.success, label: 'In stock' };

  const mrp = Number(price) || 0;
  const sell = Number(sellingPrice) || 0;
  const hasDiscount = mrp > 0 && sell > 0 && sell < mrp;
  const discountPct = hasDiscount ? Math.round(((mrp - sell) / mrp) * 100) : 0;

  const adjustStock = (delta: number) => {
    setStock(String(Math.max(0, parseQty(stock) + delta)));
  };

  const name = pickString(item?.product?.name, item?.productName, item?.name, item?.sku, 'Update stock');
  const image = resolveMediaUrl(item?.product?.thumbnail_img);
  const sku = pickString(item?.sku, params.inventoryId);
  const approval = pickString(item?.product?.approvalStatus);
  const isActive = item?.product?.is_active !== false;

  const stockHint = useMemo(() => {
    if (stockDelta === 0) {
      return outOfStock
        ? 'Customers cannot buy this SKU until you add units.'
        : lowStock
          ? `At or below the low-stock mark of ${threshold}.`
          : 'Quantity is unchanged from current stock.';
    }
    const verb = stockDelta > 0 ? 'Adding' : 'Removing';
    return `${verb} ${Math.abs(stockDelta)} ${Math.abs(stockDelta) === 1 ? 'unit' : 'units'} · was ${originalStock}`;
  }, [lowStock, originalStock, outOfStock, stockDelta, threshold]);

  if (loading) {
    return (
      <Screen>
        <AppLoader label="Loading inventory" />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <AppHeader title="Update stock" subtitle={sku ? `SKU ${sku}` : `Variant #${params.inventoryId}`} showBack />

      <View style={styles.hero}>
        <View style={styles.thumb}>
          {image ? (
            <Image source={{ uri: image }} style={styles.image} />
          ) : (
            <Text style={styles.thumbLetter}>{name.slice(0, 1).toUpperCase()}</Text>
          )}
        </View>
        <View style={styles.heroMeta}>
          <Text style={styles.heroName} numberOfLines={2}>
            {name}
          </Text>
          <View style={styles.skuPill}>
            <Package size={12} color={colors.brand[700]} />
            <Text style={styles.skuText}>SKU {sku || '—'}</Text>
          </View>
          <View style={styles.badgeRow}>
            {approval ? <AppBadge label={titleCaseStatus(approval)} /> : null}
            <AppBadge label={isActive ? 'Active' : 'Inactive'} tone={isActive ? 'success' : 'danger'} />
            {item?.isLowStock ? <AppBadge label="Low stock" tone="warning" /> : null}
          </View>
        </View>
      </View>

      <View style={styles.snapshot}>
        <View style={styles.snapItem}>
          <Text style={styles.snapLabel}>On hand</Text>
          <Text style={styles.snapValue}>{originalStock}</Text>
        </View>
        <View style={styles.snapDivider} />
        <View style={styles.snapItem}>
          <Text style={styles.snapLabel}>Selling</Text>
          <Text style={styles.snapValue}>{formatCurrency(pickNumber(item?.sellingPrice, item?.price))}</Text>
        </View>
        <View style={styles.snapDivider} />
        <View style={styles.snapItem}>
          <Text style={styles.snapLabel}>MRP</Text>
          <Text style={styles.snapValue}>{formatCurrency(pickNumber(item?.price))}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHead}>
          <View>
            <Text style={styles.cardTitle}>Quantity</Text>
            <Text style={styles.cardSub}>Units available to sell</Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: stockTone.bg }]}>
            <Text style={[styles.statusText, { color: stockTone.fg }]}>{stockTone.label}</Text>
          </View>
        </View>

        <View style={styles.stepper}>
          <Pressable
            onPress={() => adjustStock(-1)}
            disabled={nextStock <= 0}
            style={({ pressed }) => [
              styles.stepBtn,
              pressed && styles.pressed,
              nextStock <= 0 && styles.stepDisabled,
            ]}>
            <Minus size={20} color={nextStock <= 0 ? colors.tabInactive : colors.brand[800]} />
          </Pressable>
          <View style={styles.qtyBox}>
            <TextInput
              value={stock}
              onChangeText={value => setStock(value.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              style={styles.qtyInput}
              selectTextOnFocus
            />
            <Text style={styles.qtyUnit}>units</Text>
          </View>
          <Pressable
            onPress={() => adjustStock(1)}
            style={({ pressed }) => [styles.stepBtn, styles.stepBtnPlus, pressed && styles.pressed]}>
            <Plus size={20} color={colors.white} />
          </Pressable>
        </View>

        <View style={styles.chips}>
          {STOCK_STEPS.map(step => (
            <Chip key={step} label={`+${step}`} onPress={() => adjustStock(step)} />
          ))}
          {stockDelta !== 0 ? (
            <Pressable
              onPress={() => setStock(String(originalStock))}
              style={({ pressed }) => [styles.resetChip, pressed && styles.pressed]}>
              <RotateCcw size={12} color={colors.muted} />
              <Text style={styles.resetText}>Reset</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={[styles.hintRow, { backgroundColor: stockTone.bg }]}>
          {(outOfStock || lowStock) && <AlertTriangle size={14} color={stockTone.fg} />}
          <Text style={[styles.hint, { color: stockTone.fg }]}>{stockHint}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHead}>
          <View>
            <Text style={styles.cardTitle}>Pricing</Text>
            <Text style={styles.cardSub}>MRP and selling price for this SKU</Text>
          </View>
          {hasDiscount ? <AppBadge label={`${discountPct}% off`} tone="success" /> : null}
        </View>
        <View style={styles.priceRow}>
          <View style={styles.priceCol}>
            <AppInput
              label="MRP"
              keyboardType="decimal-pad"
              value={price}
              onChangeText={setPrice}
              placeholder="0"
            />
          </View>
          <View style={styles.priceCol}>
            <AppInput
              label="Selling price"
              keyboardType="decimal-pad"
              value={sellingPrice}
              onChangeText={setSellingPrice}
              placeholder="0"
            />
          </View>
        </View>
        {hasDiscount ? (
          <View style={styles.priceHint}>
            <IndianRupee size={14} color={colors.brand[700]} />
            <Text style={styles.priceHintText}>
              Customer pays {formatCurrency(sell)} instead of {formatCurrency(mrp)}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Stock alerts</Text>
        <Text style={[styles.cardSub, styles.cardSubGap]}>Get a warning when quantity drops to this level</Text>
        <AppInput
          label="Low stock at"
          keyboardType="numeric"
          value={lowStockAt}
          onChangeText={setLowStockAt}
          optional
          placeholder="e.g. 5"
        />
        <Pressable
          onPress={() => setContinueSelling(value => !value)}
          style={({ pressed }) => [styles.toggleCard, continueSelling && styles.toggleOn, pressed && styles.pressed]}>
          <View style={styles.toggleCopy}>
            <Text style={styles.toggleTitle}>Continue selling when out of stock</Text>
            <Text style={styles.toggleSub}>
              Allow checkout even if on-hand quantity is zero.
            </Text>
          </View>
          <View style={[styles.toggleTrack, continueSelling && styles.toggleTrackOn]}>
            <View style={[styles.toggleThumb, continueSelling && styles.toggleThumbOn]} />
          </View>
        </Pressable>
      </View>

      <AppButton title="Save inventory" onPress={onSubmit} loading={saving} style={styles.btn} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    ...shadows.sm,
  },
  thumb: {
    width: 84,
    height: 84,
    borderRadius: radius.lg,
    backgroundColor: colors.brand[50],
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  image: { width: '100%', height: '100%' },
  thumbLetter: { fontWeight: '800', color: colors.brand[700], fontSize: 24 },
  heroMeta: { flex: 1, minWidth: 0, justifyContent: 'center' },
  heroName: { fontWeight: '800', color: colors.text, fontSize: moderateScale(17), lineHeight: 22 },
  skuPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    backgroundColor: colors.brand[50],
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  skuText: { color: colors.brand[800], fontSize: 11, fontWeight: '700' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  snapshot: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    marginBottom: 14,
  },
  snapItem: { flex: 1, alignItems: 'center' },
  snapLabel: { color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
  snapValue: { color: colors.text, fontSize: 15, fontWeight: '800', marginTop: 4 },
  snapDivider: { width: 1, height: 28, backgroundColor: colors.border },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
    ...shadows.sm,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  cardTitle: { fontWeight: '800', color: colors.text, fontSize: 16 },
  cardSub: { color: colors.muted, fontSize: 12, fontWeight: '600', marginTop: 2 },
  cardSubGap: { marginBottom: 12 },
  statusPill: {
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusText: { fontSize: 11, fontWeight: '800' },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.brand[50],
    borderWidth: 1,
    borderColor: colors.brand[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnPlus: {
    backgroundColor: colors.brand[600],
    borderColor: colors.brand[600],
  },
  stepDisabled: { opacity: 0.45 },
  qtyBox: {
    flex: 1,
    minHeight: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  qtyInput: {
    width: '100%',
    textAlign: 'center',
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    padding: 0,
  },
  qtyUnit: { color: colors.muted, fontSize: 11, fontWeight: '700', marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, alignItems: 'center' },
  resetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    marginRight: 8,
    marginBottom: 8,
  },
  resetText: { color: colors.muted, fontWeight: '700', fontSize: 12 },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  hint: { flex: 1, fontSize: 12, fontWeight: '700' },
  priceRow: { flexDirection: 'row', gap: 12 },
  priceCol: { flex: 1 },
  priceHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: -4,
    backgroundColor: colors.brand[50],
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  priceHintText: { flex: 1, color: colors.brand[800], fontSize: 12, fontWeight: '700' },
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    padding: 12,
  },
  toggleOn: {
    backgroundColor: colors.brand[50],
    borderColor: colors.brand[200],
  },
  toggleCopy: { flex: 1, minWidth: 0 },
  toggleTitle: { color: colors.text, fontWeight: '800', fontSize: 13 },
  toggleSub: { color: colors.muted, fontSize: 12, fontWeight: '600', marginTop: 3, lineHeight: 16 },
  toggleTrack: {
    width: 44,
    height: 26,
    borderRadius: radius.full,
    backgroundColor: colors.borderStrong,
    padding: 3,
    justifyContent: 'center',
  },
  toggleTrackOn: { backgroundColor: colors.brand[500] },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: radius.full,
    backgroundColor: colors.white,
  },
  toggleThumbOn: { alignSelf: 'flex-end' },
  pressed: { opacity: 0.88 },
  btn: { marginTop: 4, marginBottom: 8 },
});
