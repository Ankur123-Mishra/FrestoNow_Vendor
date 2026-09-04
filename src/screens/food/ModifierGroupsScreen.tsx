import React, { useCallback, useState } from 'react';
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
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Layers, Pencil, Plus, Trash2, X } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { AppBadge } from '@/components/ui/AppBadge';
import { AppButton } from '@/components/ui/AppButton';
import { AppEmpty } from '@/components/ui/AppEmpty';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppInput } from '@/components/ui/AppInput';
import { AppLoader } from '@/components/ui/AppLoader';
import { Chip } from '@/components/ui/AppSwitchRow';
import { foodService } from '@/api/services';
import { useToastStore } from '@/store/toastStore';
import { colors, radius } from '@/theme';
import { asArray, getEntityId, getErrorMessage, unwrapPayload } from '@/utils/apiHelpers';
import { formatCurrency, pickString } from '@/utils/format';
import type { FoodModifierGroup } from '@/types';

type SelectionType = 'SINGLE' | 'MULTIPLE';

type OptionDraft = {
  name: string;
  price: string;
  isDefault: boolean;
};

const emptyOption = (): OptionDraft => ({
  name: '',
  price: '0',
  isDefault: false,
});

function selectionLabel(value?: string | null): SelectionType {
  return String(value || '').toUpperCase() === 'SINGLE' ? 'SINGLE' : 'MULTIPLE';
}

function optionSummary(group: FoodModifierGroup) {
  const options = asArray(group.options);
  if (!options.length) {
    return 'No options';
  }
  return options
    .map(option => {
      const price = Number(option.price);
      return price > 0
        ? `${pickString(option.name, 'Option')} +${formatCurrency(price)}`
        : pickString(option.name, 'Option');
    })
    .join(' · ');
}

export function ModifierGroupsScreen() {
  const showToast = useToastStore(s => s.show);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [groups, setGroups] = useState<FoodModifierGroup[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | number | null>(null);
  const [name, setName] = useState('');
  const [selectionType, setSelectionType] = useState<SelectionType>('SINGLE');
  const [required, setRequired] = useState(true);
  const [minSelect, setMinSelect] = useState('1');
  const [maxSelect, setMaxSelect] = useState('1');
  const [options, setOptions] = useState<OptionDraft[]>([emptyOption(), emptyOption()]);

  const load = useCallback(async () => {
    try {
      const res = await foodService.getModifierGroups();
      setGroups(asArray<FoodModifierGroup>(unwrapPayload(res.data)));
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not load modifier groups'), 'error');
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

  const resetForm = () => {
    setEditId(null);
    setName('');
    setSelectionType('SINGLE');
    setRequired(true);
    setMinSelect('1');
    setMaxSelect('1');
    setOptions([emptyOption(), emptyOption()]);
  };

  const closeModal = () => {
    setModalOpen(false);
    resetForm();
  };

  const openCreate = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEdit = (item: FoodModifierGroup) => {
    const id = getEntityId(item);
    if (id == null) {
      return;
    }
    const type = selectionLabel(item.selectionType);
    const opts = asArray(item.options).map(option => ({
      name: pickString(option.name, ''),
      price: String(option.price ?? 0),
      isDefault: Boolean(option.isDefault),
    }));
    setEditId(id);
    setName(pickString(item.name, ''));
    setSelectionType(type);
    setRequired(Boolean(item.required));
    setMinSelect(String(item.minSelect ?? (item.required ? 1 : 0)));
    setMaxSelect(String(item.maxSelect ?? (type === 'SINGLE' ? 1 : Math.max(opts.length, 1))));
    setOptions(opts.length ? opts : [emptyOption(), emptyOption()]);
    setModalOpen(true);
  };

  const onSave = async () => {
    if (!name.trim()) {
      showToast('Enter a group name', 'error');
      return;
    }
    const cleanOptions = options
      .map(option => ({
        name: option.name.trim(),
        price: Number(option.price) || 0,
        isDefault: option.isDefault,
        isActive: true,
      }))
      .filter(option => option.name);
    if (!cleanOptions.length) {
      showToast('Add at least one modifier option', 'error');
      return;
    }
    const max =
      selectionType === 'SINGLE'
        ? 1
        : Number(maxSelect) > 1
          ? Number(maxSelect)
          : cleanOptions.length;
    const min = required
      ? Math.max(1, Number(minSelect) || 1)
      : Math.max(0, Number(minSelect) || 0);

    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        selectionType,
        required,
        minSelect: Math.min(min, max),
        maxSelect: max,
        options: cleanOptions,
        isActive: editId
          ? groups.find(item => String(getEntityId(item)) === String(editId))?.isActive !== false
          : true,
      };
      if (editId != null) {
        await foodService.updateModifierGroup(editId, body);
        showToast('Modifier group updated', 'success');
      } else {
        await foodService.createModifierGroup(body);
        showToast('Modifier group added', 'success');
      }
      closeModal();
      await load();
    } catch (error) {
      showToast(
        getErrorMessage(error, editId ? 'Could not update modifier group' : 'Could not create modifier group'),
        'error',
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleGroup = async (item: FoodModifierGroup) => {
    const id = getEntityId(item);
    if (id == null) {
      return;
    }
    const key = String(id);
    setTogglingId(key);
    try {
      await foodService.updateModifierGroup(id, {
        name: pickString(item.name, 'Modifier group'),
        isActive: item.isActive === false,
        selectionType: selectionLabel(item.selectionType),
        required: Boolean(item.required),
        minSelect: Number(item.minSelect) || 0,
        maxSelect: Number(item.maxSelect) || 1,
      });
      setGroups(current =>
        current.map(group =>
          String(getEntityId(group)) === key ? { ...group, isActive: item.isActive === false } : group,
        ),
      );
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not update modifier group'), 'error');
    } finally {
      setTogglingId(null);
    }
  };

  if (loading && groups.length === 0) {
    return (
      <Screen>
        <AppLoader label="Loading modifiers" />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader
        title="Modifiers"
        subtitle="Reusable add-on groups for dishes"
        showBack
        right={
          <Pressable onPress={openCreate} style={styles.addBtn}>
            <Plus size={18} color={colors.white} />
            <Text style={styles.addText}>Group</Text>
          </Pressable>
        }
      />

      <FlatList
        data={groups}
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
            icon={Layers}
            title="No modifier groups"
            subtitle="Create extras like Choose Size or Toppings."
            actionLabel="Add modifier group"
            onAction={openCreate}
          />
        }
        renderItem={({ item }) => {
          const id = getEntityId(item);
          const active = item.isActive !== false;
          const optionsCount = asArray(item.options).length;
          const badge = `${item.required ? 'Required' : 'Optional'} · ${selectionLabel(item.selectionType)}`;
          return (
            <View style={[styles.card, !active && styles.cardInactive]}>
              <View style={styles.rowTop}>
                <View style={styles.main}>
                  <View style={styles.titleRow}>
                    <Text style={styles.name} numberOfLines={1}>
                      {pickString(item.name, 'Modifier group')}
                    </Text>
                    <AppBadge label={badge} tone={item.required ? 'warning' : 'info'} />
                  </View>
                  <Text style={styles.meta}>
                    {optionsCount} option{optionsCount === 1 ? '' : 's'}
                  </Text>
                  <Text style={styles.summary} numberOfLines={2}>
                    {optionSummary(item)}
                  </Text>
                </View>
                <View style={styles.actions}>
                  <Pressable onPress={() => openEdit(item)} style={styles.editBtn}>
                    <Pencil size={14} color={colors.brand[800]} />
                    <Text style={styles.editText}>Edit</Text>
                  </Pressable>
                  <Switch
                    value={active}
                    disabled={togglingId === String(id)}
                    onValueChange={() => toggleGroup(item)}
                    trackColor={{ false: colors.borderStrong, true: colors.brand[400] }}
                    thumbColor={colors.white}
                  />
                </View>
              </View>
            </View>
          );
        }}
      />

      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={closeModal}>
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.overlay} onPress={closeModal} />
          <View style={styles.dialog}>
            <View style={styles.dialogHead}>
              <Text style={styles.dialogTitle}>
                {editId ? 'Edit modifier group' : 'Add modifier group'}
              </Text>
              <Pressable onPress={closeModal} hitSlop={10}>
                <X size={18} color={colors.textSecondary} />
              </Pressable>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.dialogBody}
            >
              <AppInput
                label="Group name"
                value={name}
                onChangeText={setName}
                placeholder="e.g. Choose Size"
              />
              <Text style={styles.label}>Selection</Text>
              <View style={styles.chips}>
                {(['SINGLE', 'MULTIPLE'] as const).map(type => (
                  <Chip
                    key={type}
                    label={type === 'SINGLE' ? 'Single' : 'Multiple'}
                    selected={selectionType === type}
                    onPress={() => {
                      setSelectionType(type);
                      if (type === 'SINGLE') {
                        setMaxSelect('1');
                        if (required) {
                          setMinSelect('1');
                        }
                      } else {
                        setMaxSelect(String(Math.max(options.length, Number(maxSelect) || 0, 2)));
                      }
                    }}
                  />
                ))}
              </View>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Required</Text>
                <Switch
                  value={required}
                  onValueChange={value => {
                    setRequired(value);
                    setMinSelect(value ? String(Math.max(1, Number(minSelect) || 1)) : '0');
                  }}
                  trackColor={{ false: colors.borderStrong, true: colors.brand[400] }}
                  thumbColor={colors.white}
                />
              </View>
              <View style={styles.row2}>
                <View style={styles.col}>
                  <AppInput
                    label="Min"
                    value={minSelect}
                    onChangeText={setMinSelect}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={styles.col}>
                  <AppInput
                    label="Max"
                    value={selectionType === 'SINGLE' ? '1' : maxSelect}
                    onChangeText={setMaxSelect}
                    keyboardType="number-pad"
                    optional={selectionType === 'SINGLE'}
                  />
                </View>
              </View>

              {options.map((option, index) => (
                <View key={`option-${index}`} style={styles.optionCard}>
                  <View style={styles.optionHead}>
                    <Text style={styles.optionTitle}>Option {index + 1}</Text>
                    {options.length > 1 ? (
                      <Pressable
                        onPress={() => setOptions(current => current.filter((_, i) => i !== index))}
                        hitSlop={8}
                      >
                        <Trash2 size={16} color={colors.danger} />
                      </Pressable>
                    ) : null}
                  </View>
                  <AppInput
                    label="Name"
                    value={option.name}
                    onChangeText={text =>
                      setOptions(current =>
                        current.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, name: text } : row,
                        ),
                      )
                    }
                    placeholder="e.g. Regular"
                  />
                  <AppInput
                    label="Price (₹)"
                    value={option.price}
                    onChangeText={text =>
                      setOptions(current =>
                        current.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, price: text } : row,
                        ),
                      )
                    }
                    keyboardType="decimal-pad"
                  />
                  <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>Default</Text>
                    <Switch
                      value={option.isDefault}
                      onValueChange={value =>
                        setOptions(current =>
                          current.map((row, rowIndex) =>
                            rowIndex === index ? { ...row, isDefault: value } : row,
                          ),
                        )
                      }
                      trackColor={{ false: colors.borderStrong, true: colors.brand[400] }}
                      thumbColor={colors.white}
                    />
                  </View>
                </View>
              ))}

              <AppButton
                title="Add option"
                variant="outline"
                onPress={() => setOptions(current => [...current, emptyOption()])}
              />
            </ScrollView>
            <View style={styles.dialogFooter}>
              <AppButton title="Cancel" variant="outline" onPress={closeModal} style={styles.footerBtn} />
              <AppButton
                title={editId ? 'Save changes' : 'Add modifier group'}
                onPress={onSave}
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
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardInactive: { opacity: 0.62 },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  main: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name: { fontWeight: '800', fontSize: 16, color: colors.text, flexShrink: 1 },
  meta: { color: colors.muted, marginTop: 4, fontWeight: '600', fontSize: 12 },
  summary: { color: colors.textSecondary, marginTop: 4, fontWeight: '600', fontSize: 12 },
  actions: { alignItems: 'flex-end', gap: 8 },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.brand[200],
    backgroundColor: colors.brand[50],
  },
  editText: { color: colors.brand[800], fontWeight: '700', fontSize: 12 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(15,23,42,0.45)',
  },
  dialog: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '92%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  dialogHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  dialogTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  dialogBody: { paddingHorizontal: 16, paddingBottom: 12 },
  label: { color: colors.textSecondary, fontWeight: '700', marginBottom: 8, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  switchLabel: { color: colors.text, fontWeight: '600', fontSize: 14 },
  row2: { flexDirection: 'row', gap: 10 },
  col: { flex: 1 },
  optionCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 12,
    marginBottom: 10,
    backgroundColor: colors.bg,
  },
  optionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  optionTitle: { fontWeight: '800', color: colors.text },
  dialogFooter: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  footerBtn: { flex: 1 },
});
