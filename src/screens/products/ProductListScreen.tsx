import React, { useCallback, useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { PackagePlus, SearchX } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { AppBadge } from '@/components/ui/AppBadge';
import { AppEmpty } from '@/components/ui/AppEmpty';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppLoader } from '@/components/ui/AppLoader';
import { productService } from '@/api/services';
import { useToastStore } from '@/store/toastStore';
import { colors, radius } from '@/theme';
import { asArray, getEntityId, getErrorMessage, unwrapPayload } from '@/utils/apiHelpers';
import { formatCurrency, pickString } from '@/utils/format';
import { resolveMediaUrl } from '@/utils/media';
import type { AppNavigation, Product } from '@/types';

export function ProductListScreen() {
  const navigation = useNavigation<AppNavigation>();
  const showToast = useToastStore(s => s.show);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);

  const load = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }
    try {
      const res = await productService.getMine();
      setProducts(asArray<Product>(unwrapPayload(res.data)));
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not load products'), 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast]);

  useFocusEffect(
    useCallback(() => {
      load(true);
    }, [load]),
  );

  if (loading && products.length === 0) {
    return (
      <Screen>
        <AppLoader label="Loading products" />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader
        title="Products"
        subtitle={`${products.length} listed`}
        right={
          <Pressable onPress={() => navigation.navigate('ProductForm')} style={styles.addBtn}>
            <PackagePlus size={18} color={colors.white} />
            <Text style={styles.addText}>Add</Text>
          </Pressable>
        }
      />
      <FlatList
        data={products}
        keyExtractor={(item, index) => String(getEntityId(item) ?? index)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} />
        }
        ListEmptyComponent={
          <AppEmpty
            icon={SearchX}
            title="No products yet"
            subtitle="Add your first product to start selling."
            actionLabel="Add product"
            onAction={() => navigation.navigate('ProductForm')}
          />
        }
        renderItem={({ item }) => {
          const id = getEntityId(item);
          const image = resolveMediaUrl(
            (typeof item.thumbnail_img === 'string' ? item.thumbnail_img : undefined) ||
              item.images?.[0],
          );
          const price =
            item.sellingPrice ?? item.price ?? item.variants?.[0]?.sellingprice;
          return (
            <Pressable
              style={styles.row}
              onPress={() => id && navigation.navigate('ProductDetail', { productId: id })}>
              <View style={styles.thumb}>
                {image ? (
                  <Image source={{ uri: image }} style={styles.image} />
                ) : (
                  <Text style={styles.thumbLetter}>{pickString(item.name).slice(0, 1)}</Text>
                )}
              </View>
              <View style={styles.meta}>
                <Text style={styles.name} numberOfLines={1}>
                  {pickString(item.name, 'Untitled product')}
                </Text>
                <Text style={styles.price}>{price ? formatCurrency(Number(price)) : 'No price yet'}</Text>
              </View>
              <AppBadge label={item.is_active === false ? 'Inactive' : 'Active'} />
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.brand[600],
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
  },
  addText: { color: colors.white, fontWeight: '700' },
  list: { paddingBottom: 24, gap: 10, flexGrow: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.brand[50],
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
  thumbLetter: { fontWeight: '800', color: colors.brand[700], fontSize: 18 },
  meta: { flex: 1 },
  name: { fontWeight: '700', color: colors.text, fontSize: 15 },
  price: { color: colors.muted, marginTop: 4 },
});
