import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Plus, UtensilsCrossed } from 'lucide-react-native';
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
import type { FoodMenuItem, FoodSection } from '@/types';

function sectionItems(section: FoodSection): FoodMenuItem[] {
  return asArray<FoodMenuItem>(section.items || section.products || section.menuItems);
}

export function MenuSectionsScreen() {
  const showToast = useToastStore(s => s.show);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sections, setSections] = useState<FoodSection[]>([]);
  const [name, setName] = useState('');
  const [showForm, setShowForm] = useState(false);

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

  const onAdd = async () => {
    if (!name.trim()) {
      showToast('Enter a section name', 'error');
      return;
    }
    setSaving(true);
    try {
      await foodService.createSection({ name: name.trim() });
      setName('');
      setShowForm(false);
      showToast('Section added', 'success');
      load();
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not add section'), 'error');
    } finally {
      setSaving(false);
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
        subtitle={`${sections.length} sections`}
        showBack
        right={
          <Pressable onPress={() => setShowForm(value => !value)} style={styles.addBtn}>
            <Plus size={18} color={colors.white} />
            <Text style={styles.addText}>Section</Text>
          </Pressable>
        }
      />
      {showForm ? (
        <View style={styles.form}>
          <AppInput label="Section name" value={name} onChangeText={setName} placeholder="Starters" />
          <AppButton title="Save section" onPress={onAdd} loading={saving} />
        </View>
      ) : null}
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
            onAction={() => setShowForm(true)}
          />
        }
        renderItem={({ item }) => {
          const items = sectionItems(item);
          return (
            <View style={styles.card}>
              <Text style={styles.sectionName}>{pickString(item.name, item.title, 'Untitled section')}</Text>
              <Text style={styles.count}>{items.length} items</Text>
              {items.slice(0, 4).map((menuItem, index) => (
                <View key={String(getEntityId(menuItem) ?? index)} style={styles.itemRow}>
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
  form: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  list: { paddingBottom: 24, gap: 10, flexGrow: 1 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionName: { fontWeight: '800', fontSize: 16, color: colors.text },
  count: { color: colors.muted, marginTop: 2, marginBottom: 8, fontWeight: '600', fontSize: 12 },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  itemName: { flex: 1, color: colors.text, fontWeight: '600', paddingRight: 8 },
  itemPrice: { color: colors.brand[800], fontWeight: '700' },
});
