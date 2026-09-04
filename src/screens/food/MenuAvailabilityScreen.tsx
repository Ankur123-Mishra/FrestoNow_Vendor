import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Minus, Plus, UtensilsCrossed } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { AppBadge } from '@/components/ui/AppBadge';
import { AppEmpty } from '@/components/ui/AppEmpty';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppInput } from '@/components/ui/AppInput';
import { AppLoader } from '@/components/ui/AppLoader';
import { Chip } from '@/components/ui/AppSwitchRow';
import { foodService, inventoryService, productService } from '@/api/services';
import { useToastStore } from '@/store/toastStore';
import { colors, radius, shadows } from '@/theme';
import { asArray, getEntityId, getErrorMessage, unwrapPayload } from '@/utils/apiHelpers';
import { pickNumber, pickString } from '@/utils/format';
import { resolveMediaUrl } from '@/utils/media';
import type { Product, ProductVariantInput } from '@/types';

type FoodFilter = 'all' | 'sold-out' | 'low-stock';

function getVariant(product: Product): ProductVariantInput | undefined {
  return product.variants?.[0];
}

function getStock(product: Product) {
  return pickNumber(getVariant(product)?.stock);
}

export function MenuAvailabilityScreen() {
  const showToast = useToastStore(s => s.show);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FoodFilter>('all');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [savingVariantId, setSavingVariantId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await productService.getMine({ limit: 100 });
      const list = asArray<Product>(unwrapPayload(res.data));
      setProducts(list);
      setDrafts(current => {
        const next = { ...current };
        list.forEach(product => {
          const variant = getVariant(product);
          if (variant?.id == null) {
            return;
          }
          const key = String(variant.id);
          if (next[key] == null) {
            next[key] = String(pickNumber(variant.stock));
          }
        });
        return next;
      });
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not load menu items'), 'error');
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

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = products;
    if (q) {
      list = list.filter(product => {
        const variant = getVariant(product);
        return `${pickString(product.name)} ${pickString((product as { slug?: string }).slug)} ${pickString(variant?.sku)}`
          .toLowerCase()
          .includes(q);
      });
    }
    if (filter === 'sold-out') {
      list = list.filter(product => Boolean(product.foodProfile?.isSoldOut));
    } else if (filter === 'low-stock') {
      list = list.filter(product => getStock(product) <= 10);
    }
    return list;
  }, [filter, products, search]);

  const patchLocalSoldOut = (productId: string | number, isSoldOut: boolean) => {
    setProducts(current =>
      current.map(product =>
        String(product.id) === String(productId)
          ? {
              ...product,
              foodProfile: {
                ...(product.foodProfile || {}),
                isSoldOut,
              },
            }
          : product,
      ),
    );
  };

  const patchLocalStock = (variantId: string | number, stock: number) => {
    const key = String(variantId);
    setProducts(current =>
      current.map(product => {
        const variant = getVariant(product);
        if (variant == null || String(variant.id) !== key) {
          return product;
        }
        return {
          ...product,
          variants: product.variants?.map((row, index) =>
            index === 0 ? { ...row, stock } : row,
          ),
        };
      }),
    );
    setDrafts(current => ({ ...current, [key]: String(stock) }));
  };

  const toggleSoldOut = async (product: Product) => {
    const productId = product.id;
    if (productId == null) {
      return;
    }
    const soldOut = Boolean(product.foodProfile?.isSoldOut);
    const dietType = pickString(product.foodProfile?.dietType, 'VEG');
    const next = !soldOut;
    setTogglingId(String(productId));
    patchLocalSoldOut(productId, next);
    try {
      await foodService.saveItemProfile(productId, {
        dietType,
        isSoldOut: next,
      });
      showToast(next ? 'Marked as sold out' : 'Item is available again', 'success');
    } catch (error) {
      patchLocalSoldOut(productId, soldOut);
      showToast(getErrorMessage(error, 'Could not update availability'), 'error');
    } finally {
      setTogglingId(null);
    }
  };

  const saveStock = async (variantId: string | number, draft: string, currentStock: number) => {
    const n = Number(draft);
    if (!Number.isInteger(n) || n < 0) {
      showToast('Stock must be a non-negative integer', 'error');
      return;
    }
    const key = String(variantId);
    setSavingVariantId(key);
    patchLocalStock(variantId, n);
    try {
      await inventoryService.adjust(variantId, { stock: n });
      showToast('Stock updated', 'success');
      load();
    } catch (error) {
      patchLocalStock(variantId, currentStock);
      showToast(getErrorMessage(error, 'Stock update failed'), 'error');
    } finally {
      setSavingVariantId(null);
    }
  };

  if (loading && products.length === 0) {
    return (
      <Screen>
        <AppLoader label="Loading menu availability" />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader
        title="Menu Availability"
        subtitle="Mark dishes sold out or adjust daily stock limits"
        showBack
      />
      <FlatList
        data={rows}
        keyExtractor={(item, index) => String(getEntityId(item) ?? index)}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
        ListHeaderComponent={
          <View style={styles.toolbar}>
            <View style={styles.filters}>
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'sold-out', label: 'Sold out' },
                  { id: 'low-stock', label: 'Low stock' },
                ] as const
              ).map(chip => (
                <Chip
                  key={chip.id}
                  label={chip.label}
                  selected={filter === chip.id}
                  onPress={() => setFilter(chip.id)}
                />
              ))}
            </View>
            <AppInput
              label="Search"
              value={search}
              onChangeText={setSearch}
              placeholder="Search menu item or SKU…"
              optional
            />
          </View>
        }
        ListEmptyComponent={
          <AppEmpty
            icon={UtensilsCrossed}
            title="No menu items"
            subtitle="No dishes match this filter."
          />
        }
        renderItem={({ item }) => {
          const variant = getVariant(item);
          const variantId = variant?.id;
          const stock = pickNumber(variant?.stock);
          const soldOut = Boolean(item.foodProfile?.isSoldOut);
          const draftKey = variantId != null ? String(variantId) : '';
          const draft = draftKey ? drafts[draftKey] ?? String(stock) : String(stock);
          const busyToggle = togglingId === String(item.id);
          const busyStock = variantId != null && savingVariantId === String(variantId);
          const image = resolveMediaUrl(item.thumbnail_img);
          const name = pickString(item.name, 'Untitled dish');

          return (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.thumb}>
                  {image ? (
                    <Image source={{ uri: image }} style={styles.image} />
                  ) : (
                    <Text style={styles.thumbLetter}>{name.slice(0, 1).toUpperCase()}</Text>
                  )}
                </View>
                <View style={styles.meta}>
                  <Text style={styles.name} numberOfLines={2}>
                    {name}
                  </Text>
                  <Text style={styles.sku} numberOfLines={1}>
                    SKU {pickString(variant?.sku, '—')}
                  </Text>
                  <View style={styles.badgeRow}>
                    <AppBadge
                      label={`Stock ${draft || stock}`}
                      tone={
                        Number(draft || stock) <= 0
                          ? 'danger'
                          : Number(draft || stock) <= 10
                            ? 'warning'
                            : 'success'
                      }
                    />
                    <AppBadge
                      label={soldOut ? 'Sold out' : 'Available'}
                      tone={soldOut ? 'danger' : 'success'}
                    />
                  </View>
                </View>
              </View>

              <View style={styles.stockRow}>
                <Text style={styles.stockLabel}>Stock</Text>
                {variantId != null ? (
                  <View style={styles.stockControls}>
                    <Pressable
                      disabled={busyStock || Number(draft || 0) <= 0}
                      onPress={() => {
                        const next = Math.max(0, Number(draft || 0) - 1);
                        setDrafts(current => ({
                          ...current,
                          [String(variantId)]: String(next),
                        }));
                      }}
                      style={({ pressed }) => [
                        styles.stepBtn,
                        (busyStock || Number(draft || 0) <= 0) && styles.stepDisabled,
                        pressed && styles.pressed,
                      ]}>
                      <Minus size={14} color={colors.brand[800]} />
                    </Pressable>
                    <View style={styles.stockValueBox}>
                      <Text style={styles.stockValue} numberOfLines={1}>
                        {draft || '0'}
                      </Text>
                    </View>
                    <Pressable
                      disabled={busyStock}
                      onPress={() => {
                        const next = Number(draft || 0) + 1;
                        setDrafts(current => ({
                          ...current,
                          [String(variantId)]: String(next),
                        }));
                      }}
                      style={({ pressed }) => [
                        styles.stepBtn,
                        styles.stepPlus,
                        busyStock && styles.stepDisabled,
                        pressed && styles.pressed,
                      ]}>
                      <Plus size={14} color={colors.white} />
                    </Pressable>
                    <Pressable
                      disabled={busyStock}
                      onPress={() => saveStock(variantId, draft, stock)}
                      style={({ pressed }) => [
                        styles.saveBtn,
                        busyStock && styles.stepDisabled,
                        pressed && styles.pressed,
                      ]}>
                      <Text style={styles.saveText}>{busyStock ? '…' : 'Save'}</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Text style={styles.muted}>No variant</Text>
                )}
              </View>

              <View style={styles.soldOutRow}>
                <Text style={styles.soldOutTitle}>Sold out</Text>
                <Switch
                  value={soldOut}
                  disabled={busyToggle}
                  onValueChange={() => toggleSoldOut(item)}
                  trackColor={{ false: colors.borderStrong, true: colors.brand[400] }}
                  thumbColor={soldOut ? colors.brand[700] : colors.white}
                  style={styles.switch}
                />
              </View>
            </View>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 24, gap: 8, flexGrow: 1 },
  toolbar: { marginBottom: 2 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 2 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  cardTop: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.brand[50],
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  image: { width: '100%', height: '100%' },
  thumbLetter: { fontWeight: '800', color: colors.brand[700], fontSize: 15 },
  meta: { flex: 1, minWidth: 0 },
  name: { fontWeight: '800', color: colors.text, fontSize: 13 },
  sku: { color: colors.muted, marginTop: 1, fontSize: 11, fontWeight: '600' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 5 },
  stockRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stockLabel: {
    color: colors.textSecondary,
    fontWeight: '700',
    fontSize: 11,
    width: 42,
  },
  stockControls: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.brand[50],
    borderWidth: 1,
    borderColor: colors.brand[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepPlus: {
    backgroundColor: colors.brand[600],
    borderColor: colors.brand[600],
  },
  stepDisabled: { opacity: 0.45 },
  stockValueBox: {
    minWidth: 56,
    minHeight: 34,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stockValue: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    includeFontPadding: false,
  },
  saveBtn: {
    height: 34,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.brand[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: { color: colors.white, fontWeight: '800', fontSize: 11 },
  muted: { color: colors.muted, fontWeight: '600', fontSize: 12 },
  soldOutRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  soldOutTitle: { color: colors.text, fontWeight: '700', fontSize: 13 },
  switch: { transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] },
  pressed: { opacity: 0.88 },
});
