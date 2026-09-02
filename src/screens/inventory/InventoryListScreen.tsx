import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { AlertTriangle, Boxes, Package, PackageX } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { AppBadge } from '@/components/ui/AppBadge';
import { AppEmpty } from '@/components/ui/AppEmpty';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppLoader } from '@/components/ui/AppLoader';
import { inventoryService } from '@/api/services';
import { useToastStore } from '@/store/toastStore';
import { colors, radius, shadows } from '@/theme';
import { asArray, getEntityId, getErrorMessage, unwrapPayload } from '@/utils/apiHelpers';
import { formatCurrency, pickNumber, pickString, titleCaseStatus } from '@/utils/format';
import { resolveMediaUrl } from '@/utils/media';
import type { AppNavigation, InventoryItem, JsonObject } from '@/types';

function getVariantId(item: InventoryItem) {
  return item.variantId ?? item.id;
}

function getProductName(item: InventoryItem) {
  return pickString(item.product?.name, item.productName, item.name, item.sku, 'Untitled SKU');
}

function getThumbnail(item: InventoryItem) {
  return resolveMediaUrl(item.product?.thumbnail_img);
}

export function InventoryListScreen() {
  const navigation = useNavigation<AppNavigation>();
  const showToast = useToastStore(s => s.show);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await inventoryService.getAll();
      const payload = unwrapPayload(res.data) as JsonObject;
      const list = asArray<InventoryItem>(payload);
      const reportedTotal = Number(payload?.total);
      setItems(list);
      setTotal(Number.isNaN(reportedTotal) ? list.length : reportedTotal);
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not load inventory'), 'error');
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

  const summary = useMemo(() => {
    const lowStock = items.filter(item => Boolean(item.isLowStock)).length;
    const outOfStock = items.filter(item => (item.stock ?? 0) <= 0).length;
    const units = items.reduce((sum, item) => sum + pickNumber(item.stock), 0);
    return { lowStock, outOfStock, units };
  }, [items]);

  if (loading && items.length === 0) {
    return (
      <Screen>
        <AppLoader label="Loading inventory" />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader title="Inventory" subtitle={`${total} SKUs in stock`} showBack />
      <FlatList
        data={items}
        keyExtractor={(item, index) => String(getVariantId(item) ?? getEntityId(item) ?? index)}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
        }
        ListHeaderComponent={
          items.length ? (
            <View style={styles.summary}>
              <SummaryChip icon={Package} label="SKUs" value={String(total)} />
              <SummaryChip
                icon={AlertTriangle}
                label="Low stock"
                value={String(summary.lowStock)}
                tint={colors.warning}
              />
              <SummaryChip
                icon={PackageX}
                label="Out of stock"
                value={String(summary.outOfStock)}
                tint={colors.danger}
              />
              <SummaryChip icon={Boxes} label="Units" value={String(summary.units)} tint={colors.info} />
            </View>
          ) : undefined
        }
        ListEmptyComponent={
          <AppEmpty icon={Package} title="No inventory" subtitle="Stock rows will appear after products are created." />
        }
        renderItem={({ item }) => {
          const id = getVariantId(item);
          return (
            <InventoryCard
              item={item}
              onPress={() => id != null && navigation.navigate('InventoryEdit', { inventoryId: id })}
            />
          );
        }}
      />
    </Screen>
  );
}

function SummaryChip({
  icon: Icon,
  label,
  value,
  tint = colors.brand[600],
}: {
  icon: typeof Package;
  label: string;
  value: string;
  tint?: string;
}) {
  return (
    <View style={styles.chip}>
      <View style={[styles.chipIcon, { backgroundColor: `${tint}18` }]}>
        <Icon size={14} color={tint} />
      </View>
      <Text style={styles.chipValue}>{value}</Text>
      <Text style={styles.chipLabel}>{label}</Text>
    </View>
  );
}

function InventoryCard({ item, onPress }: { item: InventoryItem; onPress: () => void }) {
  const name = getProductName(item);
  const image = getThumbnail(item);
  const stock = pickNumber(item.stock);
  const lowStockAt = item.lowStockAt;
  const sellingPrice = pickNumber(item.sellingPrice, item.price);
  const mrp = pickNumber(item.price);
  const hasDiscount = mrp > 0 && sellingPrice > 0 && sellingPrice !== mrp;
  const approval = pickString(item.product?.approvalStatus);
  const isActive = item.product?.is_active !== false;
  const outOfStock = stock <= 0;
  const lowStock = Boolean(item.isLowStock) || (lowStockAt != null && stock <= Number(lowStockAt));

  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && styles.cardPressed]} onPress={onPress}>
      <View style={styles.cardTop}>
        <View style={styles.thumb}>
          {image ? (
            <Image source={{ uri: image }} style={styles.image} />
          ) : (
            <Text style={styles.thumbLetter}>{name.slice(0, 1).toUpperCase()}</Text>
          )}
        </View>
        <View style={styles.meta}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.sku} numberOfLines={1}>
            SKU {pickString(item.sku, getVariantId(item), '—')}
          </Text>
          <View style={styles.badgeRow}>
            {approval ? <AppBadge label={titleCaseStatus(approval)} /> : null}
            <AppBadge label={isActive ? 'Active' : 'Inactive'} tone={isActive ? 'success' : 'danger'} />
          </View>
        </View>
      </View>

      <View style={styles.stats}>
        <View style={styles.statBlock}>
          <Text style={[styles.stockValue, (outOfStock || lowStock) && styles.stockWarn]}>
            {stock}
          </Text>
          <Text style={styles.statLabel}>In stock</Text>
        </View>
        <View style={styles.statBlock}>
          <Text style={styles.statValue}>{lowStockAt == null ? '—' : String(lowStockAt)}</Text>
          <Text style={styles.statLabel}>Low at</Text>
        </View>
        <View style={styles.statBlock}>
          <Text style={styles.price}>{formatCurrency(sellingPrice)}</Text>
          {hasDiscount ? <Text style={styles.mrp}>{formatCurrency(mrp)}</Text> : null}
          <Text style={styles.statLabel}>{hasDiscount ? 'Selling / MRP' : 'Price'}</Text>
        </View>
      </View>

      {lowStock || outOfStock || item.continueSellingWhenOos ? (
        <View style={styles.flags}>
          {outOfStock ? <AppBadge label="Out of stock" tone="danger" /> : null}
          {!outOfStock && lowStock ? <AppBadge label="Low stock" tone="warning" /> : null}
          {item.continueSellingWhenOos ? <AppBadge label="Sell when OOS" tone="info" /> : null}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 24, gap: 12, flexGrow: 1 },
  summary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  chip: {
    flexGrow: 1,
    minWidth: '46%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipIcon: {
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipValue: { fontWeight: '800', color: colors.text, fontSize: 14 },
  chipLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  cardPressed: { opacity: 0.92 },
  cardTop: { flexDirection: 'row', gap: 12 },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    backgroundColor: colors.brand[50],
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  image: { width: '100%', height: '100%' },
  thumbLetter: { fontWeight: '800', color: colors.brand[700], fontSize: 18 },
  meta: { flex: 1, minWidth: 0 },
  name: { fontWeight: '800', color: colors.text, fontSize: 15 },
  sku: { color: colors.muted, marginTop: 3, fontSize: 12, fontWeight: '600' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  stats: {
    flexDirection: 'row',
    marginTop: 14,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  statBlock: { flex: 1, alignItems: 'center' },
  stockValue: { fontWeight: '800', color: colors.text, fontSize: 16 },
  stockWarn: { color: colors.warning },
  statValue: { fontWeight: '800', color: colors.text, fontSize: 16 },
  statLabel: { color: colors.muted, marginTop: 2, fontSize: 11, fontWeight: '600' },
  price: { fontWeight: '800', color: colors.brand[800], fontSize: 15 },
  mrp: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 2,
    textDecorationLine: 'line-through',
  },
  flags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
});
