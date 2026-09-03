import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Armchair, BellRing } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { AppButton } from '@/components/ui/AppButton';
import { AppEmpty } from '@/components/ui/AppEmpty';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppInput } from '@/components/ui/AppInput';
import { AppLoader } from '@/components/ui/AppLoader';
import { AppSelect } from '@/components/ui/AppSelect';
import { Chip } from '@/components/ui/AppSwitchRow';
import { foodService } from '@/api/services';
import { STORAGE_KEYS } from '@/config/storageKeys';
import { useToastStore } from '@/store/toastStore';
import { colors, radius } from '@/theme';
import { asArray, getEntityId, getErrorMessage, unwrapPayload } from '@/utils/apiHelpers';
import { formatCurrency, pickString } from '@/utils/format';
import { qrImageUrl, tableCode, TABLE_STATUS_STYLE, tableStatusStyle } from '@/utils/foodTables';
import { storage } from '@/utils/storage';
import type { AppNavigation, FoodFloor, FoodTable, FoodTableQrInfo, FoodTableStatus } from '@/types';

type ViewMode = 'floor' | 'setup';

export function FloorsTablesScreen() {
  const navigation = useNavigation<AppNavigation>();
  const showToast = useToastStore(s => s.show);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [qrBusy, setQrBusy] = useState(false);
  const [floors, setFloors] = useState<FoodFloor[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('floor');
  const [floorName, setFloorName] = useState('Ground');
  const [newTableFloorId, setNewTableFloorId] = useState('');
  const [newTableCode, setNewTableCode] = useState('');
  const [newTableCapacity, setNewTableCapacity] = useState('4');
  const [editTableId, setEditTableId] = useState<string | number | null>(null);
  const [qrByTableId, setQrByTableId] = useState<Record<string, FoodTableQrInfo>>({});
  const [qrViewTableId, setQrViewTableId] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await foodService.getFloors();
      const list = asArray<FoodFloor>(unwrapPayload(res.data));
      setFloors(list);
      setNewTableFloorId(current => current || (list[0] ? String(list[0].id) : ''));
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
      const timer = setInterval(() => {
        load();
      }, 15000);
      return () => clearInterval(timer);
    }, [load]),
  );

  useEffect(() => {
    storage.getJson<Record<string, FoodTableQrInfo>>(STORAGE_KEYS.TABLE_QR).then(cached => {
      if (cached) {
        setQrByTableId(cached);
      }
    });
  }, []);

  const allTables = useMemo(
    () =>
      floors.flatMap(floor =>
        asArray<FoodTable>(floor.tables).map(table => ({
          ...table,
          floorName: pickString(floor.name, 'Floor'),
          floorId: floor.id,
        })),
      ),
    [floors],
  );

  useEffect(() => {
    if (!allTables.length) {
      return;
    }
    setQrByTableId(prev => {
      const next = { ...prev };
      let changed = false;
      for (const table of allTables) {
        const id = String(getEntityId(table) ?? '');
        const url = table.qrGuestUrl;
        if (!id) {
          continue;
        }
        if (url) {
          const code = tableCode(table);
          const existing = next[id];
          if (!existing || existing.url !== url || existing.tableCode !== code) {
            next[id] = { tableId: table.id, url, tableCode: code };
            changed = true;
          }
        } else if (next[id]) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [allTables]);

  useEffect(() => {
    void storage.setJson(STORAGE_KEYS.TABLE_QR, qrByTableId);
  }, [qrByTableId]);

  useEffect(() => {
    if (qrViewTableId) {
      return;
    }
    const firstReady = allTables.find(table => {
      const id = String(getEntityId(table) ?? '');
      return Boolean(qrByTableId[id] || table.qrGuestUrl);
    });
    if (firstReady) {
      setQrViewTableId(String(getEntityId(firstReady)));
    }
  }, [allTables, qrByTableId, qrViewTableId]);

  const selectedQr = qrViewTableId ? qrByTableId[qrViewTableId] : undefined;

  const rememberQr = (info: FoodTableQrInfo) => {
    setQrByTableId(prev => ({ ...prev, [String(info.tableId)]: info }));
  };

  const issueAndCacheQr = async (tableId: string | number, rotate = false) => {
    const res = await foodService.issueTableQr(tableId, rotate);
    const body = (unwrapPayload(res.data) || res.data) as {
      guestUrl?: string;
      qrUrl?: string;
      tableCode?: string;
    };
    const info: FoodTableQrInfo = {
      tableId,
      url: pickString(body.guestUrl, body.qrUrl),
      tableCode: pickString(body.tableCode, `T${tableId}`),
    };
    rememberQr(info);
    return info;
  };

  const onAddFloor = async () => {
    setSaving(true);
    try {
      const res = await foodService.createFloor({ name: floorName.trim() || 'Floor' });
      const created = (unwrapPayload(res.data) || res.data) as { floor?: { id?: number; name?: string } };
      showToast(`Floor “${pickString(created.floor?.name, floorName)}” created`, 'success');
      if (!newTableFloorId && created.floor?.id) {
        setNewTableFloorId(String(created.floor.id));
      }
      await load();
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not create floor'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const onSaveTable = async () => {
    if (!newTableFloorId.trim() || !newTableCode.trim()) {
      showToast('Pick a floor and enter a table code', 'error');
      return;
    }
    setSaving(true);
    try {
      if (editTableId) {
        await foodService.updateTable(editTableId, {
          floorId: newTableFloorId,
          code: newTableCode.trim(),
          capacity: Number(newTableCapacity) || 4,
        });
        showToast(`Table ${newTableCode.trim()} updated`, 'success');
        setEditTableId(null);
      } else {
        await foodService.createTable({
          floorId: newTableFloorId,
          code: newTableCode.trim(),
          capacity: Number(newTableCapacity) || 4,
        });
        showToast(`Table ${newTableCode.trim()} added`, 'success');
      }
      setNewTableCode('');
      await load();
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not save table'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const onGenerateQr = async (rotate = false) => {
    if (!qrViewTableId) {
      showToast('Select a table first', 'error');
      return;
    }
    if (!rotate && selectedQr?.url) {
      showToast(`QR already saved for ${selectedQr.tableCode}`, 'success');
      return;
    }
    if (rotate) {
      Alert.alert(
        'Rotate QR?',
        'Old printed codes for this table will stop working.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Rotate',
            style: 'destructive',
            onPress: () => void runQr(true),
          },
        ],
      );
      return;
    }
    await runQr(false);
  };

  const runQr = async (rotate: boolean) => {
    setQrBusy(true);
    try {
      const info = await issueAndCacheQr(qrViewTableId, rotate);
      showToast(
        rotate ? `QR rotated for ${info.tableCode}` : `QR saved for ${info.tableCode}`,
        'success',
      );
      await load();
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not generate QR'), 'error');
    } finally {
      setQrBusy(false);
    }
  };

  const onGenerateAll = async () => {
    setQrBusy(true);
    try {
      let made = 0;
      let lastId = '';
      for (const table of allTables) {
        const id = String(getEntityId(table) ?? '');
        if (!id || qrByTableId[id]?.url || table.qrGuestUrl) {
          continue;
        }
        await issueAndCacheQr(id, false);
        made += 1;
        lastId = id;
      }
      if (lastId) {
        setQrViewTableId(lastId);
      }
      showToast(
        made ? `Saved ${made} new QR(s)` : `All ${allTables.length} table QRs already saved`,
        'success',
      );
      await load();
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not generate all QRs'), 'error');
    } finally {
      setQrBusy(false);
    }
  };

  const onShareQr = async () => {
    if (!selectedQr?.url) {
      return;
    }
    await Share.share({
      message: `Table ${selectedQr.tableCode} · Scan to order\n${selectedQr.url}`,
    });
  };

  const onPressTable = (table: FoodTable, floor: FoodFloor) => {
    const id = getEntityId(table);
    if (!id) {
      return;
    }
    if (viewMode === 'setup') {
      setEditTableId(id);
      setNewTableCode(tableCode(table));
      setNewTableCapacity(String(table.capacity ?? 4));
      setNewTableFloorId(String(floor.id));
      return;
    }
    navigation.navigate('TableCheck', {
      tableId: id,
      tableName: tableCode(table),
    });
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
      <AppHeader title="Tables & QR" subtitle="Tap a table to open the order screen" showBack />
      <View style={styles.modeRow}>
        <Chip label="Floor" selected={viewMode === 'floor'} onPress={() => setViewMode('floor')} />
        <Chip label="Setup" selected={viewMode === 'setup'} onPress={() => setViewMode('setup')} />
      </View>
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
        <View style={styles.legend}>
          {(Object.keys(TABLE_STATUS_STYLE) as FoodTableStatus[]).map(key => {
            const style = TABLE_STATUS_STYLE[key];
            return (
              <View key={key} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: style.bg, borderColor: style.border }]} />
                <Text style={styles.legendText}>{style.label}</Text>
              </View>
            );
          })}
        </View>

        {viewMode === 'floor' && allTables.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.heading}>Guest QR</Text>
            <AppSelect
              label="Table"
              value={qrViewTableId}
              placeholder="Select table"
              allowClear
              options={allTables.map(table => {
                const id = String(getEntityId(table) ?? '');
                const ready = Boolean(qrByTableId[id] || table.qrGuestUrl);
                return {
                  value: id,
                  label: `${tableCode(table)}${table.floorName ? ` · ${table.floorName}` : ''}${ready ? ' · saved' : ' · not generated'}`,
                };
              })}
              onChange={setQrViewTableId}
            />
            <View style={styles.qrActions}>
              <AppButton
                title={selectedQr ? 'Show saved' : 'Generate & save'}
                onPress={() => void onGenerateQr(false)}
                loading={qrBusy}
                disabled={!qrViewTableId}
              />
              <AppButton title="Generate all" variant="outline" onPress={() => void onGenerateAll()} loading={qrBusy} />
              <AppButton
                title="Rotate"
                variant="outline"
                onPress={() => void onGenerateQr(true)}
                disabled={!qrViewTableId || qrBusy}
              />
            </View>
            {selectedQr?.url ? (
              <View style={styles.qrCard}>
                <Image source={{ uri: qrImageUrl(selectedQr.url, 220) }} style={styles.qrImage} />
                <Text style={styles.tableName}>Table {selectedQr.tableCode}</Text>
                <Text style={styles.meta}>Saved until you Rotate · guests scan to order</Text>
                <AppButton title="Share / copy link" variant="secondary" onPress={() => void onShareQr()} />
              </View>
            ) : qrViewTableId ? (
              <Text style={styles.empty}>No QR for this table yet — tap Generate & save.</Text>
            ) : (
              <Text style={styles.empty}>Pick a table, or Generate all once.</Text>
            )}
          </View>
        ) : null}

        {viewMode === 'setup' ? (
          <View style={styles.card}>
            <Text style={styles.heading}>Setup</Text>
            <Text style={styles.meta}>Add floors and tables once — daily work stays on Floor.</Text>
            <AppInput label="Floor name" value={floorName} onChangeText={setFloorName} placeholder="Ground" />
            <AppButton title="Add floor" variant="outline" onPress={() => void onAddFloor()} loading={saving} />
            <AppSelect
              label="Floor"
              value={newTableFloorId}
              placeholder="Select floor"
              options={floors.map(floor => ({
                value: String(floor.id),
                label: pickString(floor.name, `Floor ${floor.id}`),
              }))}
              onChange={setNewTableFloorId}
            />
            <AppInput
              label="Table code"
              value={newTableCode}
              onChangeText={setNewTableCode}
              placeholder="T1"
            />
            <AppInput
              label="Capacity"
              value={newTableCapacity}
              onChangeText={setNewTableCapacity}
              keyboardType="number-pad"
              placeholder="4"
            />
            <View style={styles.rowBtns}>
              {editTableId ? (
                <AppButton
                  title="Cancel"
                  variant="outline"
                  onPress={() => {
                    setEditTableId(null);
                    setNewTableCode('');
                  }}
                  style={styles.flexBtn}
                />
              ) : null}
              <AppButton
                title={editTableId ? 'Save table' : 'Add table'}
                onPress={() => void onSaveTable()}
                loading={saving}
                style={styles.flexBtn}
              />
            </View>
          </View>
        ) : null}

        {floors.length === 0 ? (
          <AppEmpty
            icon={Armchair}
            title="No floors yet"
            subtitle="Switch to Setup to add a floor and tables."
          />
        ) : (
          floors.map((floor, floorIndex) => {
            const tables = asArray<FoodTable>(floor.tables);
            return (
              <View key={String(getEntityId(floor) ?? floorIndex)} style={styles.floor}>
                <Text style={styles.floorName}>{pickString(floor.name, `Floor ${floor.id}`)}</Text>
                {tables.length === 0 ? (
                  <Text style={styles.empty}>No tables on this floor</Text>
                ) : (
                  <View style={styles.grid}>
                    {tables.map((table, index) => {
                      const id = getEntityId(table);
                      const style = tableStatusStyle(table.status);
                      const openOrder = table.openOrder;
                      return (
                        <Pressable
                          key={String(id ?? index)}
                          style={[styles.tile, { backgroundColor: style.bg, borderColor: style.border }]}
                          onPress={() => onPressTable(table, floor)}>
                          <Text style={styles.tileCode}>{tableCode(table)}</Text>
                          {String(table.status || '').toUpperCase() === 'BILLING' ? (
                            <View style={styles.billRow}>
                              <BellRing size={12} color="#1e40af" />
                              <Text style={[styles.tileMeta, { color: '#1e40af' }]}>Bill requested</Text>
                            </View>
                          ) : (
                            <Text style={[styles.tileMeta, { color: style.text }]}>
                              {style.label} · {table.capacity ?? '—'} seats
                            </Text>
                          )}
                          {openOrder ? (
                            <Text style={styles.tileBill}>
                              {formatCurrency(openOrder.totalAmount ?? openOrder.total)}
                              {openOrder.covers ? ` · ${openOrder.covers} guests` : ''}
                            </Text>
                          ) : table.reservation ? (
                            <Text style={styles.tileRes} numberOfLines={2}>
                              {pickString(table.reservation.guestName, 'Reserved')}
                              {table.reservation.partySize ? ` · ${table.reservation.partySize} pax` : ''}
                            </Text>
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </View>
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
  modeRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 },
  scroll: { paddingBottom: 32, gap: 12 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1 },
  legendText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  heading: { fontWeight: '800', fontSize: 16, color: colors.text, marginBottom: 4 },
  qrActions: { gap: 8, marginBottom: 8 },
  qrCard: { alignItems: 'center', gap: 8, paddingTop: 8 },
  qrImage: { width: 180, height: 180, borderRadius: 12, backgroundColor: colors.surfaceMuted },
  floor: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  floorName: { fontWeight: '800', fontSize: 16, color: colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    width: '47%',
    flexGrow: 1,
    minWidth: 140,
    borderRadius: radius.md,
    borderWidth: 1.5,
    padding: 12,
    gap: 4,
  },
  tileCode: { fontWeight: '800', fontSize: 18, color: colors.text },
  tileMeta: { fontWeight: '700', fontSize: 12 },
  tileBill: { fontWeight: '800', color: colors.text, marginTop: 2 },
  tileRes: { color: colors.textSecondary, fontWeight: '600', fontSize: 12 },
  billRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tableName: { fontWeight: '800', color: colors.text, fontSize: 16 },
  meta: { color: colors.muted, fontSize: 12, fontWeight: '600', marginBottom: 8 },
  empty: { color: colors.muted, fontWeight: '600', paddingVertical: 8 },
  rowBtns: { flexDirection: 'row', gap: 8, marginTop: 4 },
  flexBtn: { flex: 1 },
});
