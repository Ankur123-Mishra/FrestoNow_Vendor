import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { CalendarClock } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { AppBadge } from '@/components/ui/AppBadge';
import { AppButton } from '@/components/ui/AppButton';
import { AppEmpty } from '@/components/ui/AppEmpty';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppInput } from '@/components/ui/AppInput';
import { AppLoader } from '@/components/ui/AppLoader';
import { foodService } from '@/api/services';
import { useToastStore } from '@/store/toastStore';
import { colors, radius } from '@/theme';
import { asArray, getEntityId, getErrorMessage, unwrapPayload } from '@/utils/apiHelpers';
import { formatDateTime, pickString, titleCaseStatus } from '@/utils/format';
import type { FoodReservation } from '@/types';

export function ReservationsScreen() {
  const showToast = useToastStore(s => s.show);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<FoodReservation[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [pax, setPax] = useState('2');
  const [time, setTime] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await foodService.getReservations();
      setRows(asArray<FoodReservation>(unwrapPayload(res.data)));
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not load reservations'), 'error');
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

  const onAdd = async () => {
    if (!customerName.trim() || !time.trim()) {
      showToast('Name and time are required', 'error');
      return;
    }
    setSaving(true);
    try {
      const iso = new Date(time).toISOString();
      await foodService.createReservation({
        customerName: customerName.trim(),
        pax: Number(pax) || 1,
        time: Number.isNaN(new Date(time).getTime()) ? time.trim() : iso,
      });
      setCustomerName('');
      setTime('');
      showToast('Reservation created', 'success');
      load();
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not create reservation'), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading && rows.length === 0) {
    return (
      <Screen>
        <AppLoader label="Loading reservations" />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader title="Reservations" subtitle="Upcoming table bookings" showBack />
      <View style={styles.form}>
        <AppInput label="Customer name" value={customerName} onChangeText={setCustomerName} placeholder="Alice" />
        <AppInput label="Guests" value={pax} onChangeText={setPax} keyboardType="number-pad" />
        <AppInput
          label="Time"
          value={time}
          onChangeText={setTime}
          placeholder="2026-09-02T20:00:00"
        />
        <AppButton title="Add reservation" onPress={onAdd} loading={saving} />
      </View>
      <FlatList
        data={rows}
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
          <AppEmpty icon={CalendarClock} title="No reservations" subtitle="New bookings will appear here." />
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.copy}>
              <Text style={styles.name}>{pickString(item.customerName, 'Guest')}</Text>
              <Text style={styles.meta}>
                {item.pax ?? 1} pax · {formatDateTime(item.time)}
              </Text>
            </View>
            <AppBadge label={titleCaseStatus(item.status) || 'Booked'} />
          </View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
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
  copy: { flex: 1 },
  name: { fontWeight: '700', color: colors.text, fontSize: 15 },
  meta: { color: colors.muted, marginTop: 4, fontWeight: '600', fontSize: 12 },
});
