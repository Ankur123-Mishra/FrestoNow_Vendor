import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '@/theme';
import { formatCurrency, pickString } from '@/utils/format';
import { productImageUrl, productUnitPrice } from '@/utils/foodTables';
import { getPosMenuAvailability } from '@/utils/posMenuAvailability';
import type { Product } from '@/types';

type Props = {
  product: Product;
  hasAddons?: boolean;
  onAdd: (product: Product) => void;
};

function dietColor(dietType: string | null) {
  const key = String(dietType || '').toUpperCase();
  if (key === 'VEG' || key === 'VEGAN') {
    return '#16a34a';
  }
  if (key === 'EGG') {
    return '#ca8a04';
  }
  if (key === 'NON_VEG' || key === 'NONVEG') {
    return '#dc2626';
  }
  return null;
}

export function PosMenuProductCard({ product, hasAddons, onAdd }: Props) {
  const priced = productUnitPrice(product);
  const avail = getPosMenuAvailability(product);
  const image = productImageUrl(product);
  const diet = dietColor(avail.dietType);
  const stockClass = avail.soldOut || avail.outOfStock ? 'sold' : avail.lowStock ? 'low' : 'ok';

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        avail.unavailable && styles.unavailable,
        pressed && !avail.unavailable && styles.pressed,
      ]}
      disabled={avail.unavailable}
      onPress={() => onAdd(product)}>
      <View style={styles.thumb}>
        {image ? (
          <Image source={{ uri: image }} style={styles.image} resizeMode="cover" />
        ) : (
          <Text style={styles.fallback}>{pickString(product.name, '+').slice(0, 1)}</Text>
        )}
      </View>
      <View style={styles.titleRow}>
        {diet ? <View style={[styles.dietDot, { backgroundColor: diet }]} /> : null}
        <Text style={styles.name} numberOfLines={2}>
          {pickString(product.name, 'Item')}
        </Text>
      </View>
      <Text style={styles.price}>{formatCurrency(priced?.price)}</Text>
      <View style={styles.metaRow}>
        {avail.stockLabel ? (
          <Text
            style={[
              styles.badge,
              stockClass === 'sold' && styles.badgeSold,
              stockClass === 'low' && styles.badgeLow,
            ]}>
            {avail.stockLabel}
          </Text>
        ) : null}
        {hasAddons && !avail.unavailable ? <Text style={styles.addonBadge}>Add-ons</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '47%',
    flexGrow: 1,
    minWidth: 140,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 8,
    gap: 6,
  },
  unavailable: { opacity: 0.5 },
  pressed: { opacity: 0.88 },
  thumb: {
    height: 88,
    borderRadius: radius.sm,
    backgroundColor: colors.border,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: '100%', height: '100%' },
  fallback: { fontWeight: '800', fontSize: 22, color: colors.muted },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  dietDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  name: { flex: 1, fontWeight: '700', color: colors.text, fontSize: 13 },
  price: { fontWeight: '800', color: colors.brand[800], fontSize: 13 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  badge: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.muted,
    backgroundColor: colors.surface,
    borderRadius: 6,
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeSold: { color: colors.danger, backgroundColor: colors.dangerSoft },
  badgeLow: { color: colors.warning, backgroundColor: colors.warningSoft },
  addonBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.brand[800],
    backgroundColor: colors.brand[50],
    borderRadius: 6,
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
});
