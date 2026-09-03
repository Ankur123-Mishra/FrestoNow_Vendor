import React, { useMemo, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Check, ChevronDown, Search, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadows } from '@/theme';
import { moderateScale } from '@/utils/responsive';

export type AppSelectOption = {
  value: string;
  label: string;
};

interface Props {
  label: string;
  value: string;
  options: AppSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string | null;
  optional?: boolean;
  searchable?: boolean;
  allowClear?: boolean;
  emptyText?: string;
}

export function AppSelect({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select',
  error,
  optional,
  searchable = true,
  allowClear,
  emptyText = 'No options found',
}: Props) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = useMemo(
    () => options.find(item => item.value === value) ?? null,
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return options;
    }
    return options.filter(item => item.label.toLowerCase().includes(q));
  }, [options, query]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  const select = (next: string) => {
    onChange(next);
    close();
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {optional ? <Text style={styles.optional}>Optional</Text> : null}
      </View>

      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.field, error ? styles.fieldError : null, open && styles.fieldOpen]}>
        <Text
          style={[styles.value, !selected && styles.placeholder]}
          numberOfLines={1}>
          {selected?.label || placeholder}
        </Text>
        <View style={styles.fieldActions}>
          {allowClear && selected ? (
            <Pressable
              onPress={() => onChange('')}
              hitSlop={10}
              style={styles.clearBtn}>
              <X size={16} color={colors.muted} />
            </Pressable>
          ) : null}
          <ChevronDown size={18} color={colors.muted} />
        </View>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.overlay} onPress={close} />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.handle} />
            <View style={styles.sheetHead}>
              <View style={styles.sheetTitles}>
                <Text style={styles.sheetTitle}>{label}</Text>
                <Text style={styles.sheetSub}>
                  {options.length
                    ? `${options.length} available · tap to select`
                    : emptyText}
                </Text>
              </View>
              <Pressable onPress={close} hitSlop={10} style={styles.closeBtn}>
                <X size={18} color={colors.textSecondary} />
              </Pressable>
            </View>

            {searchable && options.length > 6 ? (
              <View style={styles.search}>
                <Search size={16} color={colors.muted} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search"
                  placeholderTextColor={colors.muted}
                  style={styles.searchInput}
                  autoCorrect={false}
                  autoCapitalize="none"
                />
                {query ? (
                  <Pressable onPress={() => setQuery('')} hitSlop={8}>
                    <X size={14} color={colors.muted} />
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            <FlatList
              data={filtered}
              keyExtractor={item => item.value}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              style={{ maxHeight: Math.min(windowHeight * 0.52, 440) }}
              contentContainerStyle={filtered.length === 0 ? styles.listEmpty : undefined}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              ListEmptyComponent={
                <Text style={styles.empty}>
                  {options.length === 0 ? emptyText : 'No matching results'}
                </Text>
              }
              renderItem={({ item }) => {
                const isOn = item.value === value;
                return (
                  <Pressable
                    onPress={() => select(item.value)}
                    style={({ pressed }) => [
                      styles.option,
                      isOn && styles.optionOn,
                      pressed && styles.optionPressed,
                    ]}>
                    <Text
                      style={[styles.optionLabel, isOn && styles.optionLabelOn]}
                      numberOfLines={1}>
                      {item.label}
                    </Text>
                    {isOn ? <Check size={18} color={colors.brand[700]} /> : null}
                  </Pressable>
                );
              }}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  label: {
    color: colors.textSecondary,
    fontSize: moderateScale(13),
    fontWeight: '600',
  },
  optional: { color: colors.muted, fontSize: 12 },
  field: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fieldOpen: { borderColor: colors.brand[500] },
  fieldError: { borderColor: colors.danger },
  value: {
    flex: 1,
    color: colors.text,
    fontSize: moderateScale(15),
    fontWeight: '600',
  },
  placeholder: { color: colors.muted, fontWeight: '500' },
  fieldActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  clearBtn: { padding: 2 },
  error: { color: colors.danger, marginTop: 4, fontSize: 12 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '78%',
    paddingHorizontal: 16,
    paddingTop: 8,
    ...shadows.md,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.borderStrong,
    marginBottom: 12,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  sheetTitles: { flex: 1 },
  sheetTitle: {
    fontSize: moderateScale(18),
    fontWeight: '800',
    color: colors.text,
  },
  sheetSub: { color: colors.muted, marginTop: 2, fontSize: 13 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: moderateScale(14),
    paddingVertical: 8,
  },
  listEmpty: { paddingVertical: 28, alignItems: 'center' },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  option: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 12,
    borderRadius: radius.md,
  },
  optionOn: { backgroundColor: colors.brand[50] },
  optionPressed: { opacity: 0.72 },
  optionLabel: { flex: 1, color: colors.text, fontSize: moderateScale(15), fontWeight: '600' },
  optionLabelOn: { color: colors.brand[800] },
  empty: { color: colors.muted, textAlign: 'center', fontWeight: '600' },
});
