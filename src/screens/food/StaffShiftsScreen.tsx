import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Users } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { AppButton } from '@/components/ui/AppButton';
import { AppEmpty } from '@/components/ui/AppEmpty';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppLoader } from '@/components/ui/AppLoader';
import { foodService } from '@/api/services';
import { useToastStore } from '@/store/toastStore';
import { colors, radius } from '@/theme';
import { asArray, getEntityId, getErrorMessage, unwrapPayload } from '@/utils/apiHelpers';
import { pickString, titleCaseStatus } from '@/utils/format';
import type { AppNavigation, FoodStaff } from '@/types';

export function StaffShiftsScreen() {
  const navigation = useNavigation<AppNavigation>();
  const showToast = useToastStore(s => s.show);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [staff, setStaff] = useState<FoodStaff[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await foodService.getStaff();
      setStaff(asArray<FoodStaff>(unwrapPayload(res.data)));
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not load staff'), 'error');
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

  if (loading && staff.length === 0) {
    return (
      <Screen>
        <AppLoader label="Loading staff" />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader title="Staff & shifts" subtitle="Team list and cash drawer shortcuts" showBack />
      <View style={styles.actions}>
        <AppButton
          title="Manage staff"
          onPress={() => navigation.navigate('StaffManage')}
          style={styles.actionBtn}
        />
        <AppButton
          title="Cash shift"
          variant="outline"
          onPress={() => navigation.navigate('CashShift')}
          style={styles.actionBtn}
        />
      </View>
      <FlatList
        data={staff}
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
            icon={Users}
            title="No staff listed"
            subtitle="Create staff from Staff & roles."
            actionLabel="Manage staff"
            onAction={() => navigation.navigate('StaffManage')}
          />
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => navigation.navigate('StaffManage')} style={styles.row}>
            <View>
              <Text style={styles.name}>{pickString(item.name, 'Staff')}</Text>
              <Text style={styles.meta}>{pickString(item.phone, 'No phone')}</Text>
            </View>
            <Text style={styles.role}>{titleCaseStatus(item.role) || 'Team'}</Text>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  actionBtn: { flex: 1 },
  list: { paddingBottom: 24, gap: 10, flexGrow: 1 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  name: { fontWeight: '700', color: colors.text, fontSize: 15 },
  meta: { color: colors.muted, marginTop: 4, fontWeight: '600', fontSize: 12 },
  role: { color: colors.brand[800], fontWeight: '800' },
});
