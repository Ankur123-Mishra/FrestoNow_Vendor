import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '@/components/layout/Screen';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppInput } from '@/components/ui/AppInput';
import { AppLoader } from '@/components/ui/AppLoader';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { foodService } from '@/api/services';
import { useToastStore } from '@/store/toastStore';
import { colors, radius } from '@/theme';
import { asArray, getEntityId, getErrorMessage, unwrapPayload } from '@/utils/apiHelpers';
import { formatCurrency, formatDateTime, pickString } from '@/utils/format';

interface Shift {
  id?: number | string;
  status?: string;
  openingFloat?: number;
  closingFloat?: number;
  expectedCash?: number;
  variance?: number;
  openedAt?: string;
  closedAt?: string;
  [key: string]: unknown;
}

interface CashMovement {
  id?: number | string;
  type?: string;
  amount?: number;
  reason?: string;
  createdAt?: string;
}

export function CashShiftScreen() {
  const showToast = useToastStore(s => s.show);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState<Shift | null>(null);
  const [history, setHistory] = useState<Shift[]>([]);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [openingFloat, setOpeningFloat] = useState('1000');
  const [closingFloat, setClosingFloat] = useState('');
  const [moveAmount, setMoveAmount] = useState('');
  const [moveReason, setMoveReason] = useState('');

  const load = useCallback(async () => {
    try {
      const [currentRes, listRes] = await Promise.all([
        foodService.getCurrentShift(),
        foodService.getShifts(15),
      ]);
      const currentPayload = unwrapPayload(currentRes.data) as { shift?: Shift } | Shift | null;
      const shift =
        currentPayload && typeof currentPayload === 'object' && 'shift' in currentPayload
          ? (currentPayload.shift as Shift | null)
          : (currentPayload as Shift | null);
      setCurrent(shift && getEntityId(shift) ? shift : null);
      setHistory(asArray<Shift>(unwrapPayload(listRes.data)));

      const shiftId = shift ? getEntityId(shift) : null;
      if (shiftId) {
        try {
          const moveRes = await foodService.getCashMovements(shiftId);
          setMovements(asArray<CashMovement>(unwrapPayload(moveRes.data)));
        } catch {
          setMovements([]);
        }
      } else {
        setMovements([]);
      }
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not load cash shift'), 'error');
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

  const onOpen = async () => {
    setBusy(true);
    try {
      await foodService.openShift({ openingFloat: Number(openingFloat) || 0 });
      showToast('Shift opened', 'success');
      await load();
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not open shift'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const onClose = async () => {
    const id = current ? getEntityId(current) : null;
    if (!id) {
      return;
    }
    setBusy(true);
    try {
      await foodService.closeShift(id, {
        closingFloat: Number(closingFloat) || 0,
      });
      showToast('Shift closed', 'success');
      setClosingFloat('');
      await load();
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not close shift'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const onMove = async (type: 'PAY_IN' | 'PAY_OUT') => {
    const id = current ? getEntityId(current) : null;
    const amount = Number(moveAmount);
    if (!id || !amount || amount <= 0) {
      showToast('Enter a valid amount', 'error');
      return;
    }
    setBusy(true);
    try {
      await foodService.addCashMovement(id, {
        type,
        amount,
        reason: moveReason.trim() || undefined,
      });
      showToast(type === 'PAY_IN' ? 'Pay-in recorded' : 'Pay-out recorded', 'success');
      setMoveAmount('');
      setMoveReason('');
      await load();
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not record cash movement'), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading && !current && history.length === 0) {
    return (
      <Screen>
        <AppLoader label="Loading cash shift" />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader title="Cash shift" subtitle="Drawer open, close and cash movements" showBack />
      <ScrollView
        showsVerticalScrollIndicator={false}
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
        <SectionTitle title="Current shift" />
        <AppCard style={styles.card}>
          {current && getEntityId(current) ? (
            <>
              <Text style={styles.title}>
                Shift #{String(getEntityId(current))} · {pickString(current.status, 'OPEN')}
              </Text>
              <Text style={styles.meta}>Opened {formatDateTime(current.openedAt)}</Text>
              <Text style={styles.meta}>
                Opening float {formatCurrency(current.openingFloat)}
              </Text>
              <AppInput
                label="Closing float"
                value={closingFloat}
                onChangeText={setClosingFloat}
                keyboardType="decimal-pad"
              />
              <AppButton title="Close shift" onPress={onClose} loading={busy} />
              <View style={styles.moveBox}>
                <AppInput
                  label="Cash movement amount"
                  value={moveAmount}
                  onChangeText={setMoveAmount}
                  keyboardType="decimal-pad"
                />
                <AppInput
                  label="Reason"
                  value={moveReason}
                  onChangeText={setMoveReason}
                  optional
                />
                <View style={styles.rowBtns}>
                  <AppButton
                    title="Pay in"
                    variant="secondary"
                    onPress={() => onMove('PAY_IN')}
                    loading={busy}
                    style={styles.half}
                  />
                  <AppButton
                    title="Pay out"
                    variant="outline"
                    onPress={() => onMove('PAY_OUT')}
                    loading={busy}
                    style={styles.half}
                  />
                </View>
              </View>
              {movements.map((item, index) => (
                <View key={String(getEntityId(item) ?? index)} style={styles.moveRow}>
                  <Text style={styles.moveType}>{pickString(item.type, 'MOVE')}</Text>
                  <Text style={styles.moveAmt}>{formatCurrency(item.amount)}</Text>
                </View>
              ))}
            </>
          ) : (
            <>
              <Text style={styles.meta}>No open shift. Start the cash drawer to take counter sales.</Text>
              <AppInput
                label="Opening float"
                value={openingFloat}
                onChangeText={setOpeningFloat}
                keyboardType="decimal-pad"
              />
              <AppButton title="Open shift" onPress={onOpen} loading={busy} />
            </>
          )}
        </AppCard>

        <SectionTitle title="Recent shifts" />
        <AppCard style={styles.card}>
          {history.length ? (
            history.map((item, index) => (
              <View
                key={String(getEntityId(item) ?? index)}
                style={[styles.histRow, index < history.length - 1 && styles.divider]}>
                <View>
                  <Text style={styles.title}>#{String(getEntityId(item) || '—')}</Text>
                  <Text style={styles.meta}>{pickString(item.status, '—')}</Text>
                </View>
                <Text style={styles.moveAmt}>{formatCurrency(item.openingFloat)}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.meta}>No shift history yet.</Text>
          )}
        </AppCard>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 32 },
  card: { marginBottom: 8 },
  title: { fontWeight: '800', color: colors.text, fontSize: 15 },
  meta: { color: colors.muted, fontWeight: '600', fontSize: 12, marginTop: 4, marginBottom: 8 },
  moveBox: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rowBtns: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  moveRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  moveType: { fontWeight: '700', color: colors.textSecondary },
  moveAmt: { fontWeight: '800', color: colors.brand[800] },
  histRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
});
