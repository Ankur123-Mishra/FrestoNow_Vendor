import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { CalendarClock, Plus, X } from 'lucide-react-native';
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
  const [formOpen, setFormOpen] = useState(false);
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
      floors
        .flatMap(floor =>
          asArray<FoodTable>(floor.tables).map(table => ({
            value: String(getEntityId(table) ?? ''),
            label: `${tableCode(table)} · ${pickString(floor.name, 'Floor')}`,
          })),
        )
        .filter(item => item.value),
    [floors],
  );

  const bookedCount = useMemo(
    () => rows.filter(item => String(item.status || 'BOOKED').toUpperCase() === 'BOOKED').length,
    [rows],
  );

  const resetForm = () => {
    setGuestName('');
    setGuestPhone('');
    setPax('2');
    setTableId('');
    setNotes('');
    setTime(defaultReservedAt());
  };

  const openForm = () => {
    resetForm();
    setFormOpen(true);
  };

  const closeForm = () => {
    if (saving) {
      return;
    }
    setFormOpen(false);
  };

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
      setFormOpen(false);
      resetForm();
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
      <AppHeader
        title="Reservations"
        subtitle="Seat guests and manage holds"
        showBack
        right={
          <Pressable onPress={openForm} style={styles.addBtn} accessibilityRole="button">
            <Plus size={16} color={colors.white} />
            <Text style={styles.addText}>Book</Text>
          </Pressable>
        }
      />

      <View style={styles.summary}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{rows.length}</Text>
          <Text style={styles.summaryLabel}>Total</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, styles.summaryAccent]}>{bookedCount}</Text>
          <Text style={styles.summaryLabel}>Waiting</Text>
        </View>
        <Pressable onPress={openForm} style={styles.summaryCta}>
          <Text style={styles.summaryCtaText}>New booking</Text>
        </Pressable>
      </View>

      <FlatList
        style={styles.listFlex}
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
        ListEmptyComponent={
          <AppEmpty
            icon={CalendarClock}
            title="No reservations"
            subtitle="Tap Book to add a table hold."
            actionLabel="Book reservation"
            onAction={openForm}
          />
        }
        renderItem={({ item }) => {
          const status = String(item.status || 'BOOKED').toUpperCase();
          const canSeat = status === 'BOOKED';
          return (
            <View style={styles.row}>
              <View style={styles.rowTop}>
                <View style={styles.copy}>
                  <Text style={styles.name}>{pickString(item.guestName, item.customerName, 'Guest')}</Text>
                  <Text style={styles.meta}>
                    {item.partySize ?? item.pax ?? 1} pax · {formatDateTime(item.reservedAt || item.time)}
                  </Text>
                  {item.guestPhone ? <Text style={styles.meta}>{item.guestPhone}</Text> : null}
                  {item.table?.code ? <Text style={styles.meta}>Table {item.table.code}</Text> : null}
                </View>
                <AppBadge label={titleCaseStatus(item.status) || 'Booked'} />
              </View>
              {canSeat ? (
                <View style={styles.actions}>
                  <AppButton title="Seat" onPress={() => onSeat(item)} style={styles.actionBtn} />
                  <AppButton
                    title="Cancel"
                    variant="outline"
                    onPress={() => onCancel(item)}
                    style={styles.actionBtn}
                  />
                </View>
              ) : null}
            </View>
          );
        }}
      />

      <Modal visible={formOpen} transparent animationType="slide" onRequestClose={closeForm}>
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.overlay} onPress={closeForm} />
          <View style={styles.dialog}>
            <View style={styles.handle} />
            <View style={styles.dialogHead}>
              <View>
                <Text style={styles.dialogTitle}>Book reservation</Text>
                <Text style={styles.dialogSubtitle}>Guest details and table hold</Text>
              </View>
              <Pressable onPress={closeForm} hitSlop={10} style={styles.closeBtn}>
                <X size={18} color={colors.textSecondary} />
              </Pressable>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.dialogBody}>
              <AppInput label="Guest name" value={guestName} onChangeText={setGuestName} placeholder="Alice" />
              <AppInput
                label="Phone"
                value={guestPhone}
                onChangeText={setGuestPhone}
                keyboardType="phone-pad"
                placeholder="10-digit mobile"
              />
              <View style={styles.formRow}>
                <View style={styles.formHalf}>
                  <AppInput label="Party size" value={pax} onChangeText={setPax} keyboardType="number-pad" />
                </View>
                <View style={styles.formHalf}>
                  <AppInput
                    label="Date & time"
                    value={time}
                    onChangeText={setTime}
                    placeholder="YYYY-MM-DD HH:mm"
                  />
                </View>
              </View>
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
            </ScrollView>
            <View style={styles.dialogFooter}>
              <AppButton title="Cancel" variant="outline" onPress={closeForm} style={styles.footerBtn} />
              <AppButton title="Book" onPress={onAdd} loading={saving} style={styles.footerBtn} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  addText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
    gap: 12,
  },
  summaryItem: { minWidth: 54 },
  summaryValue: { fontSize: 20, fontWeight: '800', color: colors.text },
  summaryAccent: { color: colors.brand[700] },
  summaryLabel: { marginTop: 2, color: colors.muted, fontSize: 12, fontWeight: '600' },
  summaryDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: colors.border,
  },
  summaryCta: {
    marginLeft: 'auto',
    backgroundColor: colors.brand[50],
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
  },
  summaryCtaText: { color: colors.brand[800], fontWeight: '700', fontSize: 13 },
  listFlex: { flex: 1 },
  list: { paddingBottom: 24, gap: 10, flexGrow: 1 },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  copy: { flex: 1, minWidth: 0 },
  name: { fontWeight: '700', color: colors.text, fontSize: 15 },
  meta: { color: colors.muted, marginTop: 4, fontWeight: '600', fontSize: 12 },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, minHeight: 44 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  },
  dialog: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '88%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    marginTop: 10,
    marginBottom: 4,
  },
  dialogHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 12,
  },
  dialogTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  dialogSubtitle: { marginTop: 2, color: colors.muted, fontSize: 13, fontWeight: '600' },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  dialogBody: { paddingHorizontal: 16, paddingBottom: 12 },
  formRow: { flexDirection: 'row', gap: 10 },
  formHalf: { flex: 1 },
  dialogFooter: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  footerBtn: { flex: 1 },
});
