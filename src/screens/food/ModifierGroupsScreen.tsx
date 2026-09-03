import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Layers } from 'lucide-react-native';
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
import { pickString } from '@/utils/format';
import type { FoodModifierGroup } from '@/types';

export function ModifierGroupsScreen() {
  const showToast = useToastStore(s => s.show);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [groups, setGroups] = useState<FoodModifierGroup[]>([]);
  const [itemId, setItemId] = useState('');
  const [groupId, setGroupId] = useState('');

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

  const onAttach = async () => {
    if (!itemId.trim() || !groupId.trim()) {
      showToast('Enter item id and group id', 'error');
      return;
    }
    setSaving(true);
    try {
      await foodService.attachModifierGroup(itemId.trim(), groupId.trim());
      showToast('Modifier attached to item', 'success');
      setItemId('');
      setGroupId('');
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not attach modifier'), 'error');
    } finally {
      setSaving(false);
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
      <AppHeader title="Modifiers" subtitle="Add-ons like extra cheese or spice" showBack />
      <View style={styles.form}>
        <AppInput label="Menu item ID" value={itemId} onChangeText={setItemId} placeholder="123" keyboardType="number-pad" />
        <AppInput label="Modifier group ID" value={groupId} onChangeText={setGroupId} placeholder="45" keyboardType="number-pad" />
        <AppButton title="Attach to item" onPress={onAttach} loading={saving} />
      </View>
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
          <AppEmpty icon={Layers} title="No modifier groups" subtitle="Groups from Restaurant OS will appear here." />
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View>
              <Text style={styles.name}>{pickString(item.name, 'Modifier group')}</Text>
              <Text style={styles.meta}>ID {String(item.id)}</Text>
            </View>
            <Text style={styles.meta}>
              {item.minSelect ?? 0}–{item.maxSelect ?? 1}
            </Text>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  name: { fontWeight: '700', color: colors.text, fontSize: 15 },
  meta: { color: colors.muted, fontWeight: '600', fontSize: 12, marginTop: 2 },
});
