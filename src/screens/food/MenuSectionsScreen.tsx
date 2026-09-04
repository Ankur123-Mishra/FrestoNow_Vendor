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
import { launchImageLibrary } from 'react-native-image-picker';
import { Pencil, Plus, UtensilsCrossed, X } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { AppButton } from '@/components/ui/AppButton';
import { AppEmpty } from '@/components/ui/AppEmpty';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppInput } from '@/components/ui/AppInput';
import { AppLoader } from '@/components/ui/AppLoader';
import { foodService } from '@/api/services';
import { useToastStore } from '@/store/toastStore';
import { colors, radius } from '@/theme';
import { asArray, getEntityId, getErrorMessage, unwrapPayload } from '@/utils/apiHelpers';
import { formatCurrency, pickString } from '@/utils/format';
import {
  MenuSectionIcon,
  MenuSectionIconPicker,
  buildMenuSectionBody,
} from '@/utils/menuSectionIcons';
import { resolveMediaUrl } from '@/utils/media';
import type { FoodMenuItem, FoodSection, PickedImage } from '@/types';

function sectionItems(section: FoodSection): FoodMenuItem[] {
  return asArray<FoodMenuItem>(section.items || section.products || section.menuItems);
}

function mapPicked(asset: { uri?: string; type?: string; fileName?: string } | undefined): PickedImage | null {
  if (!asset?.uri) {
    return null;
  }
  return {
    uri: asset.uri,
    type: asset.type,
    fileName: asset.fileName,
  };
}

function sectionSortOrder(section: FoodSection, fallback: number) {
  const value = Number(section.sortOrder ?? section.position);
  return Number.isFinite(value) ? value : fallback;
}

export function MenuSectionsScreen() {
  const showToast = useToastStore(s => s.show);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [sections, setSections] = useState<FoodSection[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | number | null>(null);
  const [name, setName] = useState('');
  const [sectionIcon, setSectionIcon] = useState<string | null>(null);
  const [sectionIconFile, setSectionIconFile] = useState<PickedImage | null>(null);
  const [sectionIconPreview, setSectionIconPreview] = useState<string | null>(null);
  const [iconEditId, setIconEditId] = useState<string | number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await foodService.getSections();
      setSections(asArray<FoodSection>(unwrapPayload(res.data)));
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not load menu sections'), 'error');
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

  const closeModal = () => {
    setModalOpen(false);
    setEditId(null);
    setName('');
    setSectionIcon(null);
    setSectionIconFile(null);
    setSectionIconPreview(null);
  };

  const openCreate = () => {
    setEditId(null);
    setName('');
    setSectionIcon(null);
    setSectionIconFile(null);
    setSectionIconPreview(null);
    setModalOpen(true);
  };

  const openEdit = (section: FoodSection) => {
    const id = getEntityId(section);
    if (id == null) {
      return;
    }
    setEditId(id);
    setName(pickString(section.name, section.title, ''));
    setSectionIcon(section.icon ?? null);
    setSectionIconFile(null);
    setSectionIconPreview(resolveMediaUrl(section.iconUrl) ?? null);
    setModalOpen(true);
  };

  const pickCustomIcon = async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8, selectionLimit: 1 });
    const picked = mapPicked(result.assets?.[0]);
    if (!picked) {
      return;
    }
    setSectionIconFile(picked);
    setSectionIcon(null);
    setSectionIconPreview(picked.uri);
  };

  const onSave = async () => {
    if (!name.trim()) {
      showToast('Enter a section name', 'error');
      return;
    }
    setSaving(true);
    try {
      const existing = editId
        ? sections.find(item => String(getEntityId(item)) === String(editId))
        : undefined;
      const body = buildMenuSectionBody({
        name: name.trim(),
        description: existing?.description ?? '',
        sortOrder: existing ? sectionSortOrder(existing, sections.length) : sections.length + 1,
        isActive: existing ? existing.isActive !== false : true,
        icon: sectionIcon,
        iconFile: sectionIconFile,
        clearCustomIcon: Boolean(
          editId && existing?.iconUrl && !sectionIconFile && !sectionIconPreview && !sectionIcon,
        ),
      });
      if (editId != null) {
        await foodService.updateSection(editId, body);
        showToast('Section updated', 'success');
      } else {
        await foodService.createSection(body);
        showToast('Section added', 'success');
      }
      closeModal();
      await load();
    } catch (error) {
      showToast(getErrorMessage(error, editId ? 'Could not update section' : 'Could not add section'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleSection = async (section: FoodSection) => {
    const id = getEntityId(section);
    if (id == null) {
      return;
    }
    const key = String(id);
    setTogglingId(key);
    try {
      await foodService.updateSection(
        id,
        buildMenuSectionBody({
          name: pickString(section.name, section.title, 'Untitled'),
          description: section.description ?? '',
          sortOrder: sectionSortOrder(section, 0),
          isActive: section.isActive === false,
          icon: section.icon ?? null,
        }),
      );
      setSections(current =>
        current.map(item =>
          String(getEntityId(item)) === key ? { ...item, isActive: section.isActive === false } : item,
        ),
      );
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not update section'), 'error');
    } finally {
      setTogglingId(null);
    }
  };

  const updateIconQuick = async (
    section: FoodSection,
    patch: { icon?: string | null; iconFile?: PickedImage | null; clearCustomIcon?: boolean },
  ) => {
    const id = getEntityId(section);
    if (id == null) {
      return;
    }
    try {
      await foodService.updateSection(
        id,
        buildMenuSectionBody({
          name: pickString(section.name, section.title, 'Untitled'),
          description: section.description ?? '',
          sortOrder: sectionSortOrder(section, 0),
          isActive: section.isActive !== false,
          icon: patch.icon !== undefined ? patch.icon : section.icon ?? null,
          iconFile: patch.iconFile,
          clearCustomIcon: patch.clearCustomIcon,
        }),
      );
      setIconEditId(null);
      await load();
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not update icon'), 'error');
    }
  };

  if (loading && sections.length === 0) {
    return (
      <Screen>
        <AppLoader label="Loading menu" />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader
        title="Menu sections"
        subtitle={`${sections.length} sections · icons & visibility`}
        showBack
        right={
          <Pressable onPress={openCreate} style={styles.addBtn}>
            <Plus size={18} color={colors.white} />
            <Text style={styles.addText}>Section</Text>
          </Pressable>
        }
      />
      <FlatList
        data={sections}
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
            icon={UtensilsCrossed}
            title="No menu sections"
            subtitle="Add sections like Starters, Mains or Desserts."
            actionLabel="Add section"
            onAction={openCreate}
          />
        }
        renderItem={({ item, index }) => {
          const id = getEntityId(item);
          const items = sectionItems(item);
          const active = item.isActive !== false;
          const editingIcon = id != null && String(iconEditId) === String(id);
          return (
            <View style={[styles.card, !active && styles.cardInactive]}>
              <View style={styles.rowTop}>
                <Pressable
                  onPress={() => setIconEditId(editingIcon ? null : id ?? null)}
                  style={styles.iconChip}
                >
                  <MenuSectionIcon name={item.icon} iconUrl={item.iconUrl} size={18} />
                </Pressable>
                <View style={styles.main}>
                  <View style={styles.titleRow}>
                    <Text style={styles.sortChip}>#{sectionSortOrder(item, index + 1)}</Text>
                    <Text style={styles.sectionName} numberOfLines={1}>
                      {pickString(item.name, item.title, 'Untitled section')}
                    </Text>
                  </View>
                  <Text style={styles.status}>{active ? 'Visible on menu' : 'Hidden from menu'}</Text>
                  <Text style={styles.count}>{items.length} items</Text>
                </View>
                <View style={styles.actions}>
                  <Pressable onPress={() => openEdit(item)} style={styles.editBtn}>
                    <Pencil size={14} color={colors.brand[800]} />
                    <Text style={styles.editText}>Edit</Text>
                  </Pressable>
                  <Switch
                    value={active}
                    disabled={togglingId === String(id)}
                    onValueChange={() => toggleSection(item)}
                    trackColor={{ false: colors.borderStrong, true: colors.brand[400] }}
                    thumbColor={colors.white}
                  />
                </View>
              </View>

              {editingIcon ? (
                <View style={styles.iconEditor}>
                  <MenuSectionIconPicker
                    value={item.icon}
                    iconUrl={item.iconUrl}
                    onChange={icon => {
                      void updateIconQuick(item, {
                        icon,
                        clearCustomIcon: !icon,
                      });
                    }}
                    onCustomFile={async () => {
                      const result = await launchImageLibrary({
                        mediaType: 'photo',
                        quality: 0.8,
                        selectionLimit: 1,
                      });
                      const picked = mapPicked(result.assets?.[0]);
                      if (picked) {
                        void updateIconQuick(item, { icon: null, iconFile: picked });
                      }
                    }}
                    onClearCustom={() => {
                      void updateIconQuick(item, { clearCustomIcon: true, icon: null });
                    }}
                  />
                </View>
              ) : null}

              {items.slice(0, 4).map((menuItem, itemIndex) => (
                <View key={String(getEntityId(menuItem) ?? itemIndex)} style={styles.itemRow}>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {pickString(menuItem.name, 'Item')}
                  </Text>
                  <Text style={styles.itemPrice}>
                    {formatCurrency(menuItem.sellingPrice ?? menuItem.price)}
                  </Text>
                </View>
              ))}
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
              <Text style={styles.dialogTitle}>{editId ? 'Edit section' : 'Add section'}</Text>
              <Pressable onPress={closeModal} hitSlop={10}>
                <X size={18} color={colors.textSecondary} />
              </Pressable>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.dialogBody}
            >
              <AppInput label="Section name" value={name} onChangeText={setName} placeholder="e.g. Breakfast" />
              <Text style={styles.iconLabel}>Icon</Text>
              <MenuSectionIconPicker
                value={sectionIcon}
                iconUrl={sectionIconPreview}
                onChange={icon => {
                  setSectionIcon(icon);
                  setSectionIconFile(null);
                  setSectionIconPreview(null);
                }}
                onCustomFile={pickCustomIcon}
                onClearCustom={() => {
                  setSectionIconFile(null);
                  setSectionIconPreview(null);
                }}
              />
            </ScrollView>
            <View style={styles.dialogFooter}>
              <AppButton title="Cancel" variant="outline" onPress={closeModal} style={styles.footerBtn} />
              <AppButton
                title={editId ? 'Save changes' : 'Add section'}
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
  iconChip: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.brand[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  main: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sortChip: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.muted,
    backgroundColor: colors.bg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  sectionName: { flex: 1, fontWeight: '800', fontSize: 16, color: colors.text },
  status: { color: colors.muted, marginTop: 2, fontWeight: '600', fontSize: 12 },
  count: { color: colors.textSecondary, marginTop: 2, fontWeight: '600', fontSize: 12 },
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
  iconEditor: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  itemName: { flex: 1, color: colors.text, fontWeight: '600', paddingRight: 8 },
  itemPrice: { color: colors.brand[800], fontWeight: '700' },
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
    maxHeight: '88%',
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
  dialogBody: { paddingHorizontal: 16, paddingBottom: 12, gap: 4 },
  iconLabel: { color: colors.textSecondary, fontWeight: '700', marginBottom: 8, marginTop: 4 },
  dialogFooter: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  footerBtn: { flex: 1 },
});
