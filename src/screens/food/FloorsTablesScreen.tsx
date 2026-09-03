import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Armchair } from 'lucide-react-native';
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
import { pickString, titleCaseStatus } from '@/utils/format';
import type { AppNavigation, FoodFloor, FoodTable } from '@/types';

export function FloorsTablesScreen() {
  const navigation = useNavigation<AppNavigation>();
  const showToast = useToastStore(s => s.show);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [floors, setFloors] = useState<FoodFloor[]>([]);
  const [floorId, setFloorId] = useState('');
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState('4');

  const load = useCallback(async () => {
    try {
      const res = await foodService.getFloors();
      const list = asArray<FoodFloor>(unwrapPayload(res.data));
      setFloors(list);
      setFloorId(current => current || (list[0] ? String(list[0].id) : ''));
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not load floors'), 'error');
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

  const onAddTable = async () => {
    if (!floorId.trim() || !name.trim()) {
      showToast('Floor and table name are required', 'error');
      return;
    }
    setSaving(true);
    try {
      await foodService.createTable({
        floorId: floorId.trim(),
        name: name.trim(),
        capacity: Number(capacity) || 4,
      });
      setName('');
      showToast('Table added', 'success');
      load();
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not add table'), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading && floors.length === 0) {
    return (
      <Screen>
        <AppLoader label="Loading floor map" />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader title="Tables" subtitle="Dine-in floor map" showBack />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }>
        <View style={styles.form}>
          <AppInput label="Floor ID" value={floorId} onChangeText={setFloorId} placeholder="1" />
          <AppInput label="Table name" value={name} onChangeText={setName} placeholder="Table 5" />
          <AppInput
            label="Capacity"
            value={capacity}
            onChangeText={setCapacity}
            keyboardType="number-pad"
            placeholder="4"
          />
          <AppButton title="Add table" onPress={onAddTable} loading={saving} />
        </View>
        {floors.length === 0 ? (
          <AppEmpty icon={Armchair} title="No floors yet" subtitle="Floors from Restaurant OS will appear here." />
        ) : (
          floors.map((floor, floorIndex) => {
            const tables = asArray<FoodTable>(floor.tables);
            return (
              <View key={String(getEntityId(floor) ?? floorIndex)} style={styles.floor}>
                <Text style={styles.floorName}>
                  {pickString(floor.name, `Floor ${floor.id}`)}
                </Text>
                {tables.length === 0 ? (
                  <Text style={styles.empty}>No tables on this floor</Text>
                ) : (
                  tables.map((table, index) => {
                    const id = getEntityId(table);
                    return (
                      <Pressable
                        key={String(id ?? index)}
                        style={styles.table}
                        onPress={() =>
                          id &&
                          navigation.navigate('TableCheck', {
                            tableId: id,
                            tableName: pickString(table.name, `Table ${id}`),
                          })
                        }>
                        <View>
                          <Text style={styles.tableName}>{pickString(table.name, `Table ${id}`)}</Text>
                          <Text style={styles.meta}>Seats {table.capacity ?? '—'}</Text>
                        </View>
                        <Text style={styles.status}>{titleCaseStatus(table.status) || 'Open'}</Text>
                      </Pressable>
                    );
                  })
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 32, gap: 12 },
  form: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  floor: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  floorName: { fontWeight: '800', fontSize: 16, color: colors.text },
  table: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  tableName: { fontWeight: '700', color: colors.text },
  meta: { color: colors.muted, fontSize: 12, fontWeight: '600', marginTop: 2 },
  status: { color: colors.brand[800], fontWeight: '800' },
  empty: { color: colors.muted, fontWeight: '600', paddingVertical: 8 },
});
