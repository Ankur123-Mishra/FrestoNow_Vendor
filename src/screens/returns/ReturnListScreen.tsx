import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { RotateCcw } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { AppBadge } from '@/components/ui/AppBadge';
import { AppButton } from '@/components/ui/AppButton';
import { AppEmpty } from '@/components/ui/AppEmpty';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppInput } from '@/components/ui/AppInput';
import { AppLoader } from '@/components/ui/AppLoader';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Chip } from '@/components/ui/AppSwitchRow';
import { POS_REFUND_SCOPES } from '@/config/constants';
import type { PosRefundScope, ReturnAction } from '@/config/constants';
import { returnService } from '@/api/services';
import { useToastStore } from '@/store/toastStore';
import { colors, radius } from '@/theme';
import { asArray, getEntityId, getErrorMessage, unwrapPayload } from '@/utils/apiHelpers';
import { formatDate, pickString, titleCaseStatus } from '@/utils/format';
import type { ReturnRequest } from '@/types';

export function ReturnListScreen() {
  const showToast = useToastStore(s => s.show);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | number | null>(null);
  const [items, setItems] = useState<ReturnRequest[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [refundOrderId, setRefundOrderId] = useState('');
  const [refundReason, setRefundReason] = useState('Customer cancellation');
  const [refundScope, setRefundScope] = useState<PosRefundScope>('FULL');
  const [refundBusy, setRefundBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await returnService.getAll();
      setItems(asArray<ReturnRequest>(unwrapPayload(res.data)));
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not load returns'), 'error');
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

  const decide = async (id: string | number, action: ReturnAction) => {
    setBusyId(id);
    try {
      await returnService.decide(id, action, notes[String(id)]);
      showToast(`Return ${action.toLowerCase()}d`, 'success');
      await load();
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not update return'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const submitRefund = async () => {
    if (!refundOrderId.trim() || !refundReason.trim()) {
      showToast('Order ID and reason are required', 'error');
      return;
    }
    setRefundBusy(true);
    try {
      await returnService.posRefund(refundOrderId.trim(), refundScope, refundReason.trim());
      showToast('POS refund submitted', 'success');
      setRefundOrderId('');
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not submit POS refund'), 'error');
    } finally {
      setRefundBusy(false);
    }
  };

  if (loading && items.length === 0) {
    return (
      <Screen>
        <AppLoader />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader title="Return requests" subtitle="Approve or reject customer returns" showBack />
      <FlatList
        data={items}
        keyExtractor={(item, index) => String(getEntityId(item) ?? index)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
        }
        ListHeaderComponent={
          <View style={styles.refundCard}>
            <SectionTitle title="POS refund" />
            <AppInput
              label="Order ID"
              value={refundOrderId}
              onChangeText={setRefundOrderId}
              keyboardType="number-pad"
              placeholder="1"
            />
            <Text style={styles.label}>Scope</Text>
            <View style={styles.chips}>
              {POS_REFUND_SCOPES.map(scope => (
                <Chip
                  key={scope}
                  label={titleCaseStatus(scope)}
                  selected={refundScope === scope}
                  onPress={() => setRefundScope(scope)}
                />
              ))}
            </View>
            <AppInput
              label="Reason"
              value={refundReason}
              onChangeText={setRefundReason}
              placeholder="Customer cancellation"
            />
            <AppButton title="Submit POS refund" onPress={submitRefund} loading={refundBusy} />
          </View>
        }
        ListEmptyComponent={
          <AppEmpty icon={RotateCcw} title="No return requests" subtitle="Customer return requests will show here." />
        }
        renderItem={({ item }) => {
          const id = getEntityId(item);
          return (
            <View style={styles.card}>
              <View style={styles.head}>
                <Text style={styles.title}>Return #{pickString(item.id)}</Text>
                <AppBadge label={titleCaseStatus(item.status)} />
              </View>
              <Text style={styles.reason}>{pickString(item.reason, 'No reason provided')}</Text>
              <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
              <AppInput
                label="Note"
                optional
                value={notes[String(id)] || ''}
                onChangeText={v => setNotes(prev => ({ ...prev, [String(id)]: v }))}
                placeholder="Product is genuinely defective."
              />
              <View style={styles.actions}>
                <View style={styles.flex}>
                  <AppButton
                    title="Approve"
                    loading={busyId === id}
                    onPress={() => id != null && decide(id, 'APPROVE')}
                  />
                </View>
                <View style={styles.flex}>
                  <AppButton
                    title="Reject"
                    variant="danger"
                    loading={busyId === id}
                    onPress={() => id != null && decide(id, 'REJECT')}
                  />
                </View>
              </View>
            </View>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 24, gap: 12, flexGrow: 1 },
  refundCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 4,
  },
  label: { color: colors.textSecondary, fontWeight: '600', marginBottom: 6, fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontWeight: '800', color: colors.text },
  reason: { color: colors.textSecondary, lineHeight: 20 },
  date: { color: colors.muted, marginTop: 6, marginBottom: 8, fontSize: 12 },
  actions: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
});
