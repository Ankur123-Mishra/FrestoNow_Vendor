import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Minus, Plus, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '@/components/ui/AppButton';
import { colors, radius, shadows } from '@/theme';
import { formatCurrency, pickString } from '@/utils/format';
import {
  validateAddonSelection,
  type AddonSelectionResult,
  type ModifierGroupRule,
} from '@/utils/posModifiers';
import type { Product } from '@/types';

type Props = {
  open: boolean;
  product: Product | null;
  groups: ModifierGroupRule[];
  basePrice: number;
  variantId?: number | string;
  onClose: () => void;
  onConfirm: (result: AddonSelectionResult) => void;
};

export function AddonPickerModal({
  open,
  product,
  groups,
  basePrice,
  variantId,
  onClose,
  onConfirm,
}: Props) {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<number[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setSelected([]);
    setQuantity(1);
    setError(null);
  }, [open, product?.id]);

  const addonExtra = useMemo(() => {
    let sum = 0;
    for (const rule of groups) {
      for (const option of rule.group.options) {
        if (selected.includes(option.id)) {
          sum += Number(option.price ?? 0) || 0;
        }
      }
    }
    return Math.round(sum * 100) / 100;
  }, [groups, selected]);

  const unitPrice = Math.round((basePrice + addonExtra) * 100) / 100;
  const lineTotal = Math.round(unitPrice * quantity * 100) / 100;

  const toggleOption = (rule: ModifierGroupRule, optionId: number) => {
    const max = Math.max(1, rule.maxSelect ?? 1);
    const groupOptionIds = new Set(rule.group.options.map(option => option.id));
    setSelected(prev => {
      const inGroup = prev.filter(id => groupOptionIds.has(id));
      const outside = prev.filter(id => !groupOptionIds.has(id));
      if (inGroup.includes(optionId)) {
        return [...outside, ...inGroup.filter(id => id !== optionId)];
      }
      if (max === 1) {
        return [...outside, optionId];
      }
      if (inGroup.length >= max) {
        return prev;
      }
      return [...outside, ...inGroup, optionId];
    });
    setError(null);
  };

  const confirm = () => {
    if (!product) {
      return;
    }
    const validation = validateAddonSelection(groups, selected);
    if (validation) {
      setError(validation);
      return;
    }
    const addonLabels: string[] = [];
    for (const rule of groups) {
      for (const option of rule.group.options) {
        if (!selected.includes(option.id)) {
          continue;
        }
        const price = Number(option.price ?? 0) || 0;
        addonLabels.push(price > 0 ? `${option.name} (+${formatCurrency(price)})` : option.name);
      }
    }
    onConfirm({
      productId: product.id,
      variantId,
      name: pickString(product.name, 'Item'),
      basePrice,
      unitPrice,
      quantity,
      modifierOptionIds: [...selected].sort((a, b) => a - b),
      addonLabels,
    });
  };

  return (
    <Modal visible={open && Boolean(product)} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalRoot}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.overlay} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.handle} />
          <View style={styles.head}>
            <View style={styles.headText}>
              <Text style={styles.title}>{pickString(product?.name, 'Add-ons')}</Text>
              <Text style={styles.sub}>
                Base {formatCurrency(basePrice)}
                {addonExtra > 0 ? ` · add-ons +${formatCurrency(addonExtra)}` : ''}
                {' · optional — pick or skip'}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <X size={18} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.body}>
            {groups.length === 0 ? (
              <Text style={styles.muted}>No add-ons for this item.</Text>
            ) : (
              groups.map(rule => {
                const max = Math.max(1, rule.maxSelect ?? 1);
                const min = rule.required
                  ? Math.max(1, rule.minSelect ?? 1)
                  : Math.max(0, rule.minSelect ?? 0);
                return (
                  <View key={String(rule.group.id)} style={styles.group}>
                    <Text style={styles.groupName}>{rule.group.name}</Text>
                    <Text style={styles.muted}>
                      {rule.required ? 'Required' : 'Optional'}
                      {` · pick ${min === max ? min : `${min}–${max}`}`}
                    </Text>
                    <View style={styles.options}>
                      {rule.group.options.map(option => {
                        const active = selected.includes(option.id);
                        const price = Number(option.price ?? 0) || 0;
                        return (
                          <Pressable
                            key={option.id}
                            onPress={() => toggleOption(rule, option.id)}
                            style={[styles.option, active && styles.optionOn]}>
                            <Text style={[styles.optionName, active && styles.optionNameOn]}>
                              {option.name}
                            </Text>
                            <Text style={[styles.optionPrice, active && styles.optionNameOn]}>
                              {price > 0 ? `+${formatCurrency(price)}` : 'Free'}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                );
              })
            )}

            <View style={styles.qtyRow}>
              <Text style={styles.muted}>Quantity</Text>
              <View style={styles.qtyBtns}>
                <Pressable
                  onPress={() => setQuantity(q => Math.max(1, q - 1))}
                  style={styles.qtyBtn}>
                  <Minus size={14} color={colors.text} />
                </Pressable>
                <Text style={styles.qty}>{quantity}</Text>
                <Pressable onPress={() => setQuantity(q => q + 1)} style={styles.qtyBtn}>
                  <Plus size={14} color={colors.text} />
                </Pressable>
              </View>
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>

          <View style={styles.footer}>
            <AppButton title="Cancel" variant="outline" onPress={onClose} style={styles.footerBtn} />
            <AppButton
              title={`Add · ${formatCurrency(lineTotal)}`}
              onPress={confirm}
              style={styles.footerBtn}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    maxHeight: '82%',
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
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  headText: { flex: 1 },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  sub: { color: colors.muted, marginTop: 2, fontSize: 13, fontWeight: '600' },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { paddingBottom: 12, gap: 12 },
  muted: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  group: { gap: 6 },
  groupName: { fontWeight: '800', color: colors.text, fontSize: 15 },
  options: { gap: 8 },
  option: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: colors.surface,
  },
  optionOn: {
    backgroundColor: colors.brand[50],
    borderColor: colors.brand[600],
  },
  optionName: { flex: 1, fontWeight: '700', color: colors.text },
  optionNameOn: { color: colors.brand[800] },
  optionPrice: { fontWeight: '700', color: colors.muted, fontSize: 12 },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  qtyBtns: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qty: { fontWeight: '800', minWidth: 18, textAlign: 'center' },
  error: { color: colors.danger, fontWeight: '700', fontSize: 13 },
  footer: { flexDirection: 'row', gap: 8, paddingTop: 8 },
  footerBtn: { flex: 1 },
});
