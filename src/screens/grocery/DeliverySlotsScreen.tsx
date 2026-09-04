import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ChevronDown, Clock3, Plus, Users, X } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '@/components/layout/Screen';
import { AppBadge } from '@/components/ui/AppBadge';
import { AppButton } from '@/components/ui/AppButton';
import { AppEmpty } from '@/components/ui/AppEmpty';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppLoader } from '@/components/ui/AppLoader';
import { slotService } from '@/api/services';
import { useToastStore } from '@/store/toastStore';
import { colors, radius } from '@/theme';
import { asArray, getEntityId, getErrorMessage, unwrapPayload } from '@/utils/apiHelpers';
import { moderateScale } from '@/utils/responsive';
import type { DeliverySlot, SlotTemplatePayload } from '@/types';

const WEEKDAYS = [
  { value: 1, short: 'Mon', label: 'Monday' },
  { value: 2, short: 'Tue', label: 'Tuesday' },
  { value: 3, short: 'Wed', label: 'Wednesday' },
  { value: 4, short: 'Thu', label: 'Thursday' },
  { value: 5, short: 'Fri', label: 'Friday' },
  { value: 6, short: 'Sat', label: 'Saturday' },
  { value: 7, short: 'Sun', label: 'Sunday' },
] as const;

const MINUTES = [0, 15, 30, 45];
const HOURS_12 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

type PickerField = 'day' | 'start' | 'end' | null;

function weekdayMeta(dayOfWeek?: number) {
  const normalized = dayOfWeek === 0 ? 7 : dayOfWeek;
  return WEEKDAYS.find(item => item.value === normalized) ?? WEEKDAYS[0];
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function formatSlotTime(value?: string) {
  if (!value) {
    return '—';
  }
  const [hStr, mStr] = value.split(':');
  const hour = Number(hStr);
  const minute = Number(mStr);
  if (Number.isNaN(hour)) {
    return value;
  }
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${pad(hour12)}:${pad(Number.isNaN(minute) ? 0 : minute)} ${period}`;
}

function parseTime(value: string) {
  const [hStr, mStr] = value.split(':');
  const hour = Number(hStr);
  const minute = Number(mStr);
  const safeHour = Number.isNaN(hour) ? 9 : hour;
  const safeMinute = Number.isNaN(minute) ? 0 : minute;
  return {
    hour12: safeHour % 12 || 12,
    minute: MINUTES.includes(safeMinute) ? safeMinute : 0,
    period: (safeHour >= 12 ? 'PM' : 'AM') as 'AM' | 'PM',
  };
}

function to24Hour(hour12: number, minute: number, period: 'AM' | 'PM') {
  let hour = hour12 % 12;
  if (period === 'PM') {
    hour += 12;
  }
  return `${pad(hour)}:${pad(minute)}`;
}

function timeToMinutes(value: string) {
  const [h, m] = value.split(':').map(Number);
  return (Number.isNaN(h) ? 0 : h) * 60 + (Number.isNaN(m) ? 0 : m);
}

function sortTemplates(items: DeliverySlot[]) {
  return [...items].sort((a, b) => {
    const dayA = Number(a.dayOfWeek ?? 99);
    const dayB = Number(b.dayOfWeek ?? 99);
    const orderA = dayA === 0 ? 7 : dayA;
    const orderB = dayB === 0 ? 7 : dayB;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return String(a.startTime || '').localeCompare(String(b.startTime || ''));
  });
}

const EMPTY_FORM: SlotTemplatePayload = {
  dayOfWeek: 1,
  startTime: '09:00',
  endTime: '12:00',
  capacity: 20,
  isActive: true,
};

export function DeliverySlotsScreen() {
  const showToast = useToastStore(s => s.show);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [slots, setSlots] = useState<DeliverySlot[]>([]);
  const [upcoming, setUpcoming] = useState<DeliverySlot[]>([]);
  const [tab, setTab] = useState<'templates' | 'upcoming'>('templates');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [form, setForm] = useState<SlotTemplatePayload>(EMPTY_FORM);
  const [capacityText, setCapacityText] = useState('20');
  const [openPicker, setOpenPicker] = useState<PickerField>(null);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const load = useCallback(async () => {
    try {
      const [templatesRes, upcomingRes] = await Promise.all([
        slotService.getTemplates(),
        slotService.getUpcoming(7).catch(() => null),
      ]);
      setSlots(sortTemplates(asArray<DeliverySlot>(unwrapPayload(templatesRes.data))));
      if (upcomingRes) {
        setUpcoming(asArray<DeliverySlot>(unwrapPayload(upcomingRes.data)));
      }
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not load delivery slots'), 'error');
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

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setCapacityText('20');
    setErrors({});
    setOpenPicker(null);
    setModalOpen(true);
  };

  const openEdit = (item: DeliverySlot) => {
    const id = getEntityId(item);
    if (!id) {
      return;
    }
    setEditingId(id);
    setForm({
      dayOfWeek: Number(item.dayOfWeek ?? 1) || 1,
      startTime: String(item.startTime || '09:00'),
      endTime: String(item.endTime || '12:00'),
      capacity: Number(item.capacity ?? 20) || 20,
      isActive: item.isActive !== false,
    });
    setCapacityText(String(item.capacity ?? 20));
    setErrors({});
    setOpenPicker(null);
    setModalOpen(true);
  };

  const onDelete = async (item: DeliverySlot) => {
    const id = getEntityId(item);
    if (!id) {
      return;
    }
    try {
      await slotService.deleteTemplate(id);
      showToast('Template deleted', 'success');
      await load();
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not delete template'), 'error');
    }
  };

  const closeCreate = () => {
    if (saving) {
      return;
    }
    setModalOpen(false);
    setOpenPicker(null);
    setEditingId(null);
  };

  const togglePicker = (field: PickerField) => {
    setOpenPicker(current => (current === field ? null : field));
  };

  const onSubmit = async () => {
    const capacity = Number(capacityText);
    const nextErrors: Record<string, string | undefined> = {};
    if (!Number.isInteger(form.dayOfWeek)) {
      nextErrors.dayOfWeek = 'Day of week is required';
    }
    if (!form.startTime) {
      nextErrors.startTime = 'Start time is required';
    }
    if (!form.endTime) {
      nextErrors.endTime = 'End time is required';
    }
    if (form.startTime && form.endTime && timeToMinutes(form.endTime) <= timeToMinutes(form.startTime)) {
      nextErrors.endTime = 'End time must be after start time';
    }
    if (!capacityText.trim() || Number.isNaN(capacity) || capacity <= 0) {
      nextErrors.capacity = 'Enter a valid capacity';
    }
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) {
      return;
    }

    setSaving(true);
    try {
      const payload = {
        dayOfWeek: form.dayOfWeek,
        startTime: form.startTime,
        endTime: form.endTime,
        capacity,
        isActive: form.isActive,
      };
      if (editingId) {
        await slotService.updateTemplate(editingId, payload);
        showToast('Template updated', 'success');
      } else {
        await slotService.createTemplate(payload);
        showToast('Template created', 'success');
      }
      setModalOpen(false);
      setOpenPicker(null);
      setEditingId(null);
      await load();
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not save template'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const selectedDay = weekdayMeta(form.dayOfWeek);

  if (loading && slots.length === 0) {
    return (
      <Screen>
        <AppLoader label="Loading delivery slots" />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader title="Delivery slots" subtitle="Weekly grocery windows" showBack />

      <Pressable onPress={openCreate} style={styles.addBtn}>
        <Plus size={18} color={colors.white} />
        <Text style={styles.addBtnText}>Add template</Text>
      </Pressable>

      <View style={styles.tabs}>
        <Pressable
          onPress={() => setTab('templates')}
          style={[styles.tab, tab === 'templates' && styles.tabOn]}>
          <Text style={[styles.tabText, tab === 'templates' && styles.tabTextOn]}>Templates</Text>
        </Pressable>
        <Pressable
          onPress={() => setTab('upcoming')}
          style={[styles.tab, tab === 'upcoming' && styles.tabOn]}>
          <Text style={[styles.tabText, tab === 'upcoming' && styles.tabTextOn]}>Upcoming</Text>
        </Pressable>
      </View>

      <FlatList
        data={tab === 'templates' ? slots : upcoming}
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
            icon={Clock3}
            title={tab === 'templates' ? 'No templates yet' : 'No upcoming slots'}
            subtitle={
              tab === 'templates'
                ? 'Create a weekly window so customers can book grocery delivery slots.'
                : 'Generated slots for the next 7 days will appear here.'
            }
            actionLabel={tab === 'templates' ? 'Add template' : undefined}
            onAction={tab === 'templates' ? openCreate : undefined}
          />
        }
        renderItem={({ item }) =>
          tab === 'templates' ? (
            <TemplateCard item={item} onEdit={() => openEdit(item)} onDelete={() => onDelete(item)} />
          ) : (
            <UpcomingCard item={item} />
          )
        }
      />

      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={closeCreate}>
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.overlay} onPress={closeCreate} />
          <View style={styles.dialog}>
            <View style={styles.dialogHead}>
              <Text style={styles.dialogTitle}>{editingId ? 'Edit template' : 'New template'}</Text>
              <Pressable onPress={closeCreate} hitSlop={10} style={styles.closeBtn}>
                <X size={18} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.dialogBody}>
              <Text style={styles.fieldLabel}>Day of week</Text>
              <Pressable
                onPress={() => togglePicker('day')}
                style={[styles.field, openPicker === 'day' && styles.fieldOpen, errors.dayOfWeek && styles.fieldError]}>
                <Text style={styles.fieldValue}>{selectedDay.short}</Text>
                <ChevronDown
                  size={18}
                  color={colors.muted}
                  style={openPicker === 'day' ? styles.chevronOpen : undefined}
                />
              </Pressable>
              {errors.dayOfWeek ? <Text style={styles.error}>{errors.dayOfWeek}</Text> : null}
              {openPicker === 'day' ? (
                <View style={styles.pickerBox}>
                  {WEEKDAYS.map(day => {
                    const selected = day.value === form.dayOfWeek;
                    return (
                      <Pressable
                        key={day.value}
                        onPress={() => {
                          setForm(prev => ({ ...prev, dayOfWeek: day.value }));
                          setOpenPicker(null);
                        }}
                        style={[styles.optionRow, selected && styles.optionOn]}>
                        <Text style={[styles.optionText, selected && styles.optionTextOn]}>{day.short}</Text>
                        <Text style={[styles.optionSub, selected && styles.optionTextOn]}>{day.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              <TimeField
                label="Start time"
                value={form.startTime}
                open={openPicker === 'start'}
                error={errors.startTime}
                onToggle={() => togglePicker('start')}
                onChange={startTime => setForm(prev => ({ ...prev, startTime }))}
              />

              <TimeField
                label="End time"
                value={form.endTime}
                open={openPicker === 'end'}
                error={errors.endTime}
                onToggle={() => togglePicker('end')}
                onChange={endTime => setForm(prev => ({ ...prev, endTime }))}
              />

              <Text style={styles.fieldLabel}>Capacity</Text>
              <View style={[styles.field, errors.capacity && styles.fieldError]}>
                <TextInput
                  value={capacityText}
                  onChangeText={setCapacityText}
                  keyboardType="number-pad"
                  placeholder="20"
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                />
              </View>
              {errors.capacity ? <Text style={styles.error}>{errors.capacity}</Text> : null}

              <View style={styles.activeRow}>
                <Text style={styles.activeLabel}>Active</Text>
                <Switch
                  value={form.isActive}
                  onValueChange={isActive => setForm(prev => ({ ...prev, isActive }))}
                  trackColor={{ false: colors.borderStrong, true: colors.brand[400] }}
                  thumbColor={form.isActive ? colors.white : colors.white}
                />
              </View>
            </ScrollView>

            <View style={styles.dialogFooter}>
              <AppButton title="Cancel" variant="outline" onPress={closeCreate} style={styles.footerBtn} />
              <AppButton
                title={editingId ? 'Update' : 'Create'}
                onPress={onSubmit}
                loading={saving}
                style={styles.footerBtn}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

function TemplateCard({
  item,
  onEdit,
  onDelete,
}: {
  item: DeliverySlot;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const day = weekdayMeta(item.dayOfWeek);
  const active = item.isActive !== false;

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={[styles.dayBadge, !active && styles.dayBadgeOff]}>
          <Text style={[styles.dayShort, !active && styles.dayShortOff]}>{day.short}</Text>
        </View>
        <View style={styles.cardCopy}>
          <Text style={styles.timeRange}>
            {formatSlotTime(item.startTime)} – {formatSlotTime(item.endTime)}
          </Text>
          <Text style={styles.dayLabel}>{day.label}</Text>
        </View>
        <AppBadge label={active ? 'Active' : 'Inactive'} />
      </View>
      <View style={styles.cardMeta}>
        <Users size={15} color={colors.muted} />
        <Text style={styles.capacityText}>
          {item.capacity ?? 0} {Number(item.capacity) === 1 ? 'order' : 'orders'} capacity
        </Text>
      </View>
      <View style={styles.cardActions}>
        <Pressable onPress={onEdit} style={styles.cardAction}>
          <Text style={styles.cardActionText}>Edit</Text>
        </Pressable>
        <Pressable onPress={onDelete} style={[styles.cardAction, styles.cardActionDanger]}>
          <Text style={[styles.cardActionText, styles.cardActionDangerText]}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );
}

function UpcomingCard({ item }: { item: DeliverySlot }) {
  const dateLabel = pickUpcomingDate(item);
  const remaining =
    item.remaining != null
      ? Number(item.remaining)
      : Math.max(0, Number(item.capacity ?? 0) - Number((item as { bookedCount?: number }).bookedCount ?? 0));

  return (
    <View style={styles.card}>
      <Text style={styles.timeRange}>{dateLabel}</Text>
      <Text style={styles.dayLabel}>
        {formatSlotTime(item.startTime || String((item as { startAt?: string }).startAt || ''))} –{' '}
        {formatSlotTime(item.endTime || String((item as { endAt?: string }).endAt || ''))}
      </Text>
      <View style={styles.cardMeta}>
        <Users size={15} color={colors.muted} />
        <Text style={styles.capacityText}>
          {remaining} remaining · capacity {item.capacity ?? 0}
        </Text>
      </View>
    </View>
  );
}

function pickUpcomingDate(item: DeliverySlot) {
  const raw = (item as { date?: string; startAt?: string }).date || (item as { startAt?: string }).startAt;
  if (!raw) {
    return 'Upcoming slot';
  }
  try {
    return new Date(raw).toDateString();
  } catch {
    return String(raw);
  }
}

function TimeField({
  label,
  value,
  open,
  error,
  onToggle,
  onChange,
}: {
  label: string;
  value: string;
  open: boolean;
  error?: string;
  onToggle: () => void;
  onChange: (value: string) => void;
}) {
  const parsed = useMemo(() => parseTime(value), [value]);

  const apply = (next: Partial<typeof parsed>) => {
    const hour12 = next.hour12 ?? parsed.hour12;
    const minute = next.minute ?? parsed.minute;
    const period = next.period ?? parsed.period;
    onChange(to24Hour(hour12, minute, period));
  };

  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable onPress={onToggle} style={[styles.field, open && styles.fieldOpen, error && styles.fieldError]}>
        <Text style={styles.fieldValue}>{formatSlotTime(value)}</Text>
        <Clock3 size={18} color={colors.muted} />
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {open ? (
        <View style={styles.timePicker}>
          <View style={styles.timeCol}>
            <Text style={styles.timeColLabel}>Hour</Text>
            <ScrollView style={styles.timeScroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
              {HOURS_12.map(hour => {
                const selected = hour === parsed.hour12;
                return (
                  <Pressable
                    key={hour}
                    onPress={() => apply({ hour12: hour })}
                    style={[styles.timeChip, selected && styles.timeChipOn]}>
                    <Text style={[styles.timeChipText, selected && styles.timeChipTextOn]}>{pad(hour)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
          <View style={styles.timeCol}>
            <Text style={styles.timeColLabel}>Min</Text>
            <ScrollView style={styles.timeScroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
              {MINUTES.map(minute => {
                const selected = minute === parsed.minute;
                return (
                  <Pressable
                    key={minute}
                    onPress={() => apply({ minute })}
                    style={[styles.timeChip, selected && styles.timeChipOn]}>
                    <Text style={[styles.timeChipText, selected && styles.timeChipTextOn]}>{pad(minute)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
          <View style={styles.timeCol}>
            <Text style={styles.timeColLabel}>Period</Text>
            {(['AM', 'PM'] as const).map(period => {
              const selected = period === parsed.period;
              return (
                <Pressable
                  key={period}
                  onPress={() => apply({ period })}
                  style={[styles.timeChip, selected && styles.timeChipOn]}>
                  <Text style={[styles.timeChipText, selected && styles.timeChipTextOn]}>{period}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  addBtn: {
    minHeight: 46,
    borderRadius: radius.md,
    backgroundColor: colors.brand[600],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 14,
  },
  addBtnText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: moderateScale(14),
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    minHeight: 40,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabOn: {
    backgroundColor: colors.brand[50],
    borderColor: colors.brand[400],
  },
  tabText: { color: colors.textSecondary, fontWeight: '700', fontSize: 13 },
  tabTextOn: { color: colors.brand[800] },
  list: { paddingBottom: 24, gap: 12, flexGrow: 1 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dayBadge: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.brand[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBadgeOff: { backgroundColor: colors.surfaceMuted },
  dayShort: {
    color: colors.brand[800],
    fontWeight: '800',
    fontSize: moderateScale(13),
    letterSpacing: 0.4,
  },
  dayShortOff: { color: colors.muted },
  cardCopy: { flex: 1 },
  timeRange: {
    fontWeight: '800',
    color: colors.text,
    fontSize: moderateScale(15),
  },
  dayLabel: {
    color: colors.muted,
    marginTop: 3,
    fontSize: 12,
    fontWeight: '600',
  },
  cardMeta: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  capacityText: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 13,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  cardAction: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.brand[50],
  },
  cardActionDanger: { backgroundColor: colors.dangerSoft },
  cardActionText: { color: colors.brand[800], fontWeight: '700', fontSize: 12 },
  cardActionDangerText: { color: colors.danger },
  modalRoot: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay,
  },
  dialog: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    maxHeight: '88%',
    overflow: 'hidden',
  },
  dialogHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 8,
  },
  dialogTitle: {
    fontSize: moderateScale(20),
    fontWeight: '800',
    color: colors.text,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogBody: {
    paddingHorizontal: 18,
    paddingBottom: 8,
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontSize: moderateScale(13),
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 12,
  },
  field: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldOpen: { borderColor: colors.brand[500] },
  fieldError: { borderColor: colors.danger },
  fieldValue: {
    flex: 1,
    color: colors.text,
    fontSize: moderateScale(15),
    fontWeight: '600',
  },
  chevronOpen: { transform: [{ rotate: '180deg' }] },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: moderateScale(15),
    fontWeight: '600',
    paddingVertical: 12,
  },
  error: { color: colors.danger, marginTop: 4, fontSize: 12 },
  pickerBox: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  optionRow: {
    minHeight: 44,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
  },
  optionOn: { backgroundColor: colors.brand[50] },
  optionText: { color: colors.text, fontWeight: '700', fontSize: 15 },
  optionSub: { color: colors.muted, fontWeight: '600', fontSize: 12 },
  optionTextOn: { color: colors.brand[800] },
  timePicker: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 10,
    flexDirection: 'row',
    gap: 8,
  },
  timeCol: { flex: 1 },
  timeColLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  timeScroll: { maxHeight: 168 },
  timeChip: {
    minHeight: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  timeChipOn: { backgroundColor: colors.brand[50] },
  timeChipText: { color: colors.textSecondary, fontWeight: '700', fontSize: 14 },
  timeChipTextOn: { color: colors.brand[800] },
  activeRow: {
    marginTop: 16,
    marginBottom: 8,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activeLabel: {
    color: colors.text,
    fontWeight: '600',
    fontSize: moderateScale(15),
  },
  dialogFooter: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerBtn: { flex: 1 },
});
