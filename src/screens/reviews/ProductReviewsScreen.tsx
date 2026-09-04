import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Star } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { AppBadge } from '@/components/ui/AppBadge';
import { AppEmpty } from '@/components/ui/AppEmpty';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppLoader } from '@/components/ui/AppLoader';
import { reviewService } from '@/api/services';
import { useToastStore } from '@/store/toastStore';
import { colors, radius } from '@/theme';
import { asArray, getEntityId, getErrorMessage, unwrapPayload } from '@/utils/apiHelpers';
import { formatDateTime, pickString } from '@/utils/format';

interface ProductReview {
  id?: number | string;
  stars?: number;
  rating?: number;
  comment?: string;
  createdAt?: string;
  product?: { name?: string; id?: number | string } | string;
  user?: { name?: string } | string;
  [key: string]: unknown;
}

export function ProductReviewsScreen() {
  const showToast = useToastStore(s => s.show);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reviews, setReviews] = useState<ProductReview[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await reviewService.getProductReviews();
      setReviews(asArray<ProductReview>(unwrapPayload(res.data)));
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not load product reviews'), 'error');
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

  if (loading && reviews.length === 0) {
    return (
      <Screen>
        <AppLoader label="Loading reviews" />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader title="Product reviews" subtitle="Customer ratings on your catalog" showBack />
      <FlatList
        data={reviews}
        keyExtractor={(item, index) => String(getEntityId(item) ?? index)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
        ListEmptyComponent={
          <AppEmpty icon={Star} title="No product reviews" subtitle="Reviews will appear after customers rate products." />
        }
        renderItem={({ item }) => {
          const productName =
            typeof item.product === 'string'
              ? item.product
              : pickString(item.product?.name, 'Product');
          const userName =
            typeof item.user === 'string' ? item.user : pickString(item.user?.name, 'Customer');
          const stars = Number(item.stars ?? item.rating ?? 0);
          return (
            <View style={styles.card}>
              <View style={styles.top}>
                <Text style={styles.title} numberOfLines={1}>
                  {productName}
                </Text>
                <AppBadge label={`${stars || 0}★`} tone="info" />
              </View>
              <Text style={styles.meta}>
                {userName} · {formatDateTime(item.createdAt)}
              </Text>
              {item.comment ? <Text style={styles.comment}>{String(item.comment)}</Text> : null}
            </View>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 24, gap: 10, flexGrow: 1 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { flex: 1, fontWeight: '800', color: colors.text, fontSize: 15 },
  meta: { color: colors.muted, marginTop: 6, fontWeight: '600', fontSize: 12 },
  comment: { color: colors.textSecondary, marginTop: 10, fontWeight: '600', lineHeight: 20 },
});
