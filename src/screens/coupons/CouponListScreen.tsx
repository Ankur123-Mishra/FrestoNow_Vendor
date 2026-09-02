import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Percent } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { AppBadge } from '@/components/ui/AppBadge';
import { AppEmpty } from '@/components/ui/AppEmpty';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppLoader } from '@/components/ui/AppLoader';
import { couponService } from '@/api/services';
import { useToastStore } from '@/store/toastStore';
import { colors, radius } from '@/theme';
import { asArray, getEntityId, getErrorMessage, unwrapPayload } from '@/utils/apiHelpers';
import { formatDate, pickString, titleCaseStatus } from '@/utils/format';
import type { AppNavigation, Coupon } from '@/types';

export function CouponListScreen() {
  const navigation = useNavigation<AppNavigation>();
  const showToast = useToastStore(s => s.show);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<Coupon[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await couponService.getAll();
      setItems(asArray<Coupon>(unwrapPayload(res.data)));
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not load coupons'), 'error');
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

  if (loading && items.length === 0) {
    return (
      <Screen>
        <AppLoader label="Loading coupons" />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader
        title="Coupons"
        subtitle={`${items.length} offers`}
        showBack
        right={
          <Pressable onPress={() => navigation.navigate('CouponForm')} style={styles.addBtn}>
            <Text style={styles.addText}>Add</Text>
          </Pressable>
        }
      />
      <FlatList
        data={items}
        keyExtractor={(item, index) => String(getEntityId(item) ?? index)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
        }
        ListEmptyComponent={
          <AppEmpty
            icon={Percent}
            title="No coupons yet"
            subtitle="Create a percentage or flat discount for your shop."
            actionLabel="Add coupon"
            onAction={() => navigation.navigate('CouponForm')}
          />
        }
        renderItem={({ item }) => {
          const id = getEntityId(item);
          return (
            <Pressable
              style={styles.row}
              onPress={() => navigation.navigate('CouponForm', { couponId: id })}>
              <View style={styles.meta}>
                <Text style={styles.code}>{pickString(item.code, `Coupon ${item.id}`)}</Text>
                <Text style={styles.sub}>
                  {titleCaseStatus(item.type)} {item.value}
                  {item.expiresAt ? ` · till ${formatDate(item.expiresAt)}` : ''}
                </Text>
              </View>
              <AppBadge label={item.isActive === false ? 'Inactive' : 'Active'} />
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  addBtn: {
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
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  meta: { flex: 1 },
  code: { fontWeight: '800', color: colors.text, fontSize: 15 },
  sub: { color: colors.muted, marginTop: 4, fontSize: 12 },
});
