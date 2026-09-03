import React, { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { CalendarClock } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { AppBadge } from '@/components/ui/AppBadge';
import { AppButton } from '@/components/ui/AppButton';
import { AppEmpty } from '@/components/ui/AppEmpty';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppInput } from '@/components/ui/AppInput';
import { AppLoader } from '@/components/ui/AppLoader';
import { AppSelect } from '@/components/ui/AppSelect';
import { foodService } from '@/api/services';
import { useToastStore } from '@/store/toastStore';
import { colors, radius } from '@/theme';
import { asArray, getEntityId, getErrorMessage, unwrapPayload } from '@/utils/apiHelpers';
import { formatDateTime, pickString, titleCaseStatus } from '@/utils/format';
import { tableCode } from '@/utils/foodTables';
import type { FoodFloor, FoodReservation, FoodTable } from '@/types';

function defaultReservedAt() {
  const date = new Date();
  date.setMinutes(date.getMinutes() + 60);
  date.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function ReservationsScreen() {
  const showToast = useToastStore(s => s.show);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<FoodReservation[]>([]);
  const [floors, setFloors] = useState<FoodFloor[]>([]);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [pax, setPax] = useState('2');
  const [time, setTime] = useState(defaultReservedAt());
  const [tableId, setTableId] = useState('');
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    try {
      const [res, floorRes] = await Promise.all([
        foodService.getReservations(),
        foodService.getFloors(),
      ]);
      setRows(asArray<FoodReservation>(unwrapPayload(res.data)));
      setFloors(asArray<FoodFloor>(unwrapPayload(floorRes.data)));
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

  const tableOptions = useMemo(
    () =>
      floors.flatMap(floor =>
        asArray<FoodTable>(floor.tables).map(table => ({
          value: String(getEntityId(table) ?? ''),
          label: `${tableCode(table)} · ${pickString(floor.name, 'Floor')}`,
        })),
      ).filter(item => item.value),
    [floors],
  );

  const onAdd = async () => {
    const phoneDigits = guestPhone.replace(/\D/g, '');
    if (!guestName.trim()) {
      showToast('Guest name is required', 'error');
      return;
    }
    if (phoneDigits.length < 10) {
      showToast('Guest phone (min 10 digits) is required', 'error');
      return;
    }
    if (!time.trim()) {
      showToast('Date & time is required', 'error');
      return;
    }
    const parsed = new Date(time.replace(' ', 'T'));
    setSaving(true);
    try {
      await foodService.createReservation({
        guestName: guestName.trim(),
        guestPhone: guestPhone.trim(),
        partySize: Number(pax) || 2,
        reservedAt: Number.isNaN(parsed.getTime()) ? time.trim() : parsed.toISOString(),
        tableId: tableId || undefined,
        notes: notes.trim() || undefined,
      });
      setGuestName('');
      setGuestPhone('');
      setPax('2');
      setTableId('');
      setNotes('');
      setTime(defaultReservedAt());
      showToast('Reservation booked', 'success');
      load();
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not book reservation'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const onSeat = (item: FoodReservation) => {
    const id = getEntityId(item);
    if (!id) {
      return;
    }
    Alert.alert('Seat guest', `Open a check for ${pickString(item.guestName, item.customerName, 'guest')}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Seat',
        onPress: () =>
          void (async () => {
            try {
              await foodService.seatReservation(id, {
                tableId: item.table?.id ?? item.tableId ?? undefined,
                guestPhone: item.guestPhone || undefined,
              });
              showToast('Guest seated', 'success');
              load();
            } catch (error) {
              showToast(getErrorMessage(error, 'Could not seat guest'), 'error');
            }
          })(),
      },
    ]);
  };

  const onCancel = (item: FoodReservation) => {
    const id = getEntityId(item);
    if (!id) {
      return;
    }
    Alert.alert('Cancel reservation?', pickString(item.guestName, item.customerName, 'This booking'), [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel',
        style: 'destructive',
        onPress: () =>
          void (async () => {
            try {
              await foodService.updateReservation(id, { status: 'CANCELLED', reason: 'Cancelled from vendor app' });
              showToast('Reservation cancelled', 'success');
              load();
            } catch (error) {
              showToast(getErrorMessage(error, 'Could not cancel'), 'error');
            }
          })(),
      },
    ]);
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
      <AppHeader title="Reservations" subtitle="Book, seat and cancel table holds" showBack />
      <View style={styles.form}>
        <AppInput label="Guest name" value={guestName} onChangeText={setGuestName} placeholder="Alice" />
        <AppInput
          label="Phone"
          value={guestPhone}
          onChangeText={setGuestPhone}
          keyboardType="phone-pad"
          placeholder="10-digit mobile"
        />
        <AppInput label="Party size" value={pax} onChangeText={setPax} keyboardType="number-pad" />
        <AppInput
          label="Date & time"
          value={time}
          onChangeText={setTime}
          placeholder="YYYY-MM-DD HH:mm"
        />
        <AppSelect
          label="Table"
          value={tableId}
          options={tableOptions}
          onChange={setTableId}
          placeholder="Any available"
          optional
          allowClear
        />
        <AppInput label="Notes" value={notes} onChangeText={setNotes} placeholder="Window seat" optional />
        <AppButton title="Book reservation" onPress={onAdd} loading={saving} />
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
        renderItem={({ item }) => {
          const status = String(item.status || 'BOOKED').toUpperCase();
          const canSeat = status === 'BOOKED';
          return (
            <View style={styles.row}>
              <View style={styles.copy}>
                <Text style={styles.name}>{pickString(item.guestName, item.customerName, 'Guest')}</Text>
                <Text style={styles.meta}>
                  {item.partySize ?? item.pax ?? 1} pax · {formatDateTime(item.reservedAt || item.time)}
                </Text>
                {item.guestPhone ? <Text style={styles.meta}>{item.guestPhone}</Text> : null}
                {item.table?.code ? <Text style={styles.meta}>Table {item.table.code}</Text> : null}
              </View>
              <View style={styles.side}>
                <AppBadge label={titleCaseStatus(item.status) || 'Booked'} />
                {canSeat ? (
                  <>
                    <AppButton title="Seat" variant="secondary" onPress={() => onSeat(item)} />
                    <AppButton title="Cancel" variant="ghost" onPress={() => onCancel(item)} />
                  </>
                ) : null}
              </View>
            </View>
          );
        }}
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
    alignItems: 'flex-start',
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
  side: { alignItems: 'flex-end', gap: 6, maxWidth: 120 },
});
