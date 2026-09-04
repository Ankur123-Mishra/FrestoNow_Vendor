import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MessageSquare } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { AppBadge } from '@/components/ui/AppBadge';
import { AppEmpty } from '@/components/ui/AppEmpty';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppLoader } from '@/components/ui/AppLoader';
import { reviewService } from '@/api/services';
import { useAuthStore } from '@/store/authStore';
import { useToastStore } from '@/store/toastStore';
import { colors, radius } from '@/theme';
import { asArray, getEntityId, getErrorMessage, unwrapPayload } from '@/utils/apiHelpers';
import { formatDateTime, pickString } from '@/utils/format';

interface OrderReview {
  id?: number | string;
  vendorRating?: number;
  vendorReview?: string;
  createdAt?: string;
  order?: { orderNumber?: string; id?: number | string };
  user?: { name?: string };
  [key: string]: unknown;
}

export function OrderReviewsScreen() {
  const showToast = useToastStore(s => s.show);
  const vendorId = useAuthStore(s => s.user?.id);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reviews, setReviews] = useState<OrderReview[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await reviewService.getOrderReviews({ vendorId });
      const payload = unwrapPayload(res.data) as { reviews?: OrderReview[] } | OrderReview[];
      const list = Array.isArray(payload)
        ? payload
        : asArray<OrderReview>(payload?.reviews ?? payload);
      setReviews(list);
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not load order reviews'), 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast, vendorId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (loading && reviews.length === 0) {
    return (
      <Screen>
        <AppLoader label="Loading order reviews" />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader title="Order reviews" subtitle="Customer feedback on fulfilled orders" showBack />
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
          <AppEmpty
            icon={MessageSquare}
            title="No order reviews"
            subtitle="Feedback after delivery will show up here."
          />
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.top}>
              <Text style={styles.title}>
                Order {pickString(item.order?.orderNumber, String(item.order?.id || item.id || '—'))}
              </Text>
              <AppBadge label={`${Number(item.vendorRating ?? 0)}★`} tone="info" />
            </View>
            <Text style={styles.meta}>
              {pickString(item.user?.name, 'Customer')} · {formatDateTime(item.createdAt)}
            </Text>
            {item.vendorReview ? <Text style={styles.comment}>{String(item.vendorReview)}</Text> : null}
          </View>
        )}
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
