import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ArrowDownLeft, ArrowUpRight, Banknote, Wallet } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { AppBadge } from '@/components/ui/AppBadge';
import { AppButton } from '@/components/ui/AppButton';
import { AppEmpty } from '@/components/ui/AppEmpty';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppInput } from '@/components/ui/AppInput';
import { AppLoader } from '@/components/ui/AppLoader';
import { Chip } from '@/components/ui/AppSwitchRow';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { walletService } from '@/api/services';
import { useToastStore } from '@/store/toastStore';
import { colors, radius, shadows } from '@/theme';
import {
  asArray,
  getErrorMessage,
  mapWalletBalance,
  mapWalletSummary,
  unwrapPayload,
} from '@/utils/apiHelpers';
import { formatCurrency, formatDate, pickNumber, pickString, titleCaseStatus } from '@/utils/format';
import { moderateScale } from '@/utils/responsive';
import type { WalletHistoryItem } from '@/types';

const QUICK_AMOUNTS = [1000, 2500, 5000];

const LEDGER_KIND_LABEL: Record<string, string> = {
  SETTLE: 'Order credited',
  REVERSE: 'Refund reversal',
  PAYOUT: 'Payout',
  ADJUST: 'Manual adjust',
};

function isCreditEntry(item: WalletHistoryItem) {
  const direction = pickString(item.direction).toUpperCase();
  if (direction === 'CREDIT') {
    return true;
  }
  if (direction === 'DEBIT') {
    return false;
  }

  const type = pickString(
    item.type,
    item.txnType,
    item.transactionType,
    item.entryType,
    item.entryKind,
  ).toLowerCase();
  const amount = pickNumber(item.amount);
  if (/debit|payout|withdraw|deduct|charge|paid|reverse/.test(type)) {
    return false;
  }
  if (/credit|deposit|refund|bonus|added|received|settle/.test(type)) {
    return true;
  }
  return amount >= 0;
}

function historyTitle(item: WalletHistoryItem) {
  const description = pickString(item.description);
  if (description) {
    return description;
  }
  const kind = pickString(item.entryKind).toUpperCase();
  if (kind && LEDGER_KIND_LABEL[kind]) {
    return LEDGER_KIND_LABEL[kind];
  }
  return pickString(item.entryKind, item.transactionType, item.type, 'Transaction');
}

function historyBadge(item: WalletHistoryItem) {
  return titleCaseStatus(
    pickString(item.direction, item.type, item.entryKind, item.transactionType, 'txn'),
  );
}

function parseHistoryPayload(payload: unknown): WalletHistoryItem[] {
  const nested = unwrapPayload(payload) as Record<string, unknown> | unknown;
  if (Array.isArray(nested)) {
    return nested as WalletHistoryItem[];
  }
  if (nested && typeof nested === 'object') {
    const obj = nested as Record<string, unknown>;
    if (Array.isArray(obj.entries) && obj.entries.length > 0) {
      return obj.entries as WalletHistoryItem[];
    }
    if (Array.isArray(obj.history) && obj.history.length > 0) {
      return obj.history as WalletHistoryItem[];
    }
    if (Array.isArray(obj.entries)) {
      return obj.entries as WalletHistoryItem[];
    }
    if (Array.isArray(obj.history)) {
      return obj.history as WalletHistoryItem[];
    }
  }
  return asArray<WalletHistoryItem>(payload);
}

export function WalletScreen() {
  const showToast = useToastStore(s => s.show);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payoutBusy, setPayoutBusy] = useState(false);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [balance, setBalance] = useState(0);
  const [history, setHistory] = useState<WalletHistoryItem[]>([]);
  const [summaryTotals, setSummaryTotals] = useState<{ credit: number; debit: number } | null>(
    null,
  );
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('Weekly payout request');

  const load = useCallback(async () => {
    try {
      const [balanceRes, historyRes, summaryResult, financeBalanceResult] = await Promise.all([
        walletService.getBalance(),
        walletService.getHistory(),
        walletService.getSummary().catch(() => null),
        walletService.getFinanceBalance().catch(() => null),
      ]);

      const walletBalance = mapWalletBalance(balanceRes.data).balance;
      const financeRaw = financeBalanceResult?.data
        ? mapWalletBalance(financeBalanceResult.data).balance
        : 0;
      const summary = summaryResult?.data ? mapWalletSummary(summaryResult.data) : null;

      setBalance(financeRaw || summary?.balance || walletBalance);
      setHistory(parseHistoryPayload(historyRes.data));
      setSummaryTotals(
        summary
          ? { credit: summary.credit, debit: summary.debit }
          : null,
      );
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not load wallet'), 'error');
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

  const totals = useMemo(() => {
    if (summaryTotals) {
      return summaryTotals;
    }
    let credit = 0;
    let debit = 0;
    for (const item of history) {
      const value = Math.abs(pickNumber(item.amount));
      if (isCreditEntry(item)) {
        credit += value;
      } else {
        debit += value;
      }
    }
    return { credit, debit };
  }, [history, summaryTotals]);

  const requestPayout = async () => {
    const value = Number(amount);
    if (!value || value <= 0) {
      showToast('Enter a valid payout amount', 'error');
      return;
    }
    if (value > balance) {
      showToast('Amount cannot exceed available balance', 'error');
      return;
    }
    setPayoutBusy(true);
    try {
      await walletService.requestPayout(value, reason.trim() || 'Payout request');
      showToast('Payout requested', 'success');
      setAmount('');
      setPayoutOpen(false);
      await load();
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not request payout'), 'error');
    } finally {
      setPayoutBusy(false);
    }
  };

  if (loading && history.length === 0 && balance === 0) {
    return (
      <Screen>
        <AppLoader label="Loading wallet" />
      </Screen>
    );
  }

  const header = (
    <View>
      <View style={styles.balanceCard}>
        <View style={styles.blobOne} />
        <View style={styles.blobTwo} />
        <View style={styles.balanceTop}>
          <View style={styles.balanceIcon}>
            <Wallet size={20} color={colors.white} />
          </View>
          <View style={styles.balanceCopy}>
            <Text style={styles.balanceLabel}>Available balance</Text>
            <Text style={styles.balanceHint}>Ready for payout</Text>
          </View>
        </View>
        <Text style={styles.balanceValue}>{formatCurrency(balance)}</Text>
        <View style={styles.statRow}>
          <View style={styles.statChip}>
            <ArrowDownLeft size={14} color={colors.brand[100]} />
            <View>
              <Text style={styles.statLabel}>In</Text>
              <Text style={styles.statValue}>{formatCurrency(totals.credit)}</Text>
            </View>
          </View>
          <View style={styles.statChip}>
            <ArrowUpRight size={14} color={colors.brand[100]} />
            <View>
              <Text style={styles.statLabel}>Out</Text>
              <Text style={styles.statValue}>{formatCurrency(totals.debit)}</Text>
            </View>
          </View>
        </View>
        <Pressable
          onPress={() => setPayoutOpen(open => !open)}
          style={({ pressed }) => [styles.payoutCta, pressed && styles.pressed]}>
          <Banknote size={18} color={colors.brand[800]} />
          <Text style={styles.payoutCtaText}>{payoutOpen ? 'Hide payout form' : 'Request payout'}</Text>
        </Pressable>
      </View>

      {payoutOpen ? (
        <View style={styles.payout}>
          <Text style={styles.payoutTitle}>Payout request</Text>
          <AppInput
            label="Amount"
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
            placeholder="5000"
          />
          <View style={styles.chips}>
            {QUICK_AMOUNTS.map(value => (
              <Chip
                key={value}
                label={formatCurrency(value)}
                selected={amount === String(value)}
                onPress={() => setAmount(String(value))}
              />
            ))}
            {balance > 0 ? (
              <Chip
                label="All"
                selected={amount === String(balance)}
                onPress={() => setAmount(String(balance))}
              />
            ) : null}
          </View>
          <AppInput
            label="Reason"
            value={reason}
            onChangeText={setReason}
            placeholder="Weekly payout request"
          />
          <AppButton title="Submit payout" onPress={requestPayout} loading={payoutBusy} />
        </View>
      ) : null}

      <SectionTitle title="History" action={<Text style={styles.count}>{history.length} entries</Text>} />
    </View>
  );

  return (
    <Screen>
      <AppHeader title="Wallet" subtitle="Balance, ledger and payouts" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          data={history}
          keyExtractor={(item, index) => String(item.id ?? index)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListHeaderComponent={header}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
          }
          ListEmptyComponent={
            <AppEmpty icon={Wallet} title="No wallet activity" subtitle="Credits and deductions will show here." />
          }
          renderItem={({ item }) => {
            const credit = isCreditEntry(item);
            const value = Math.abs(pickNumber(item.amount));
            return (
              <View style={styles.row}>
                <View style={[styles.txnIcon, credit ? styles.txnIn : styles.txnOut]}>
                  {credit ? (
                    <ArrowDownLeft size={16} color={colors.success} />
                  ) : (
                    <ArrowUpRight size={16} color={colors.danger} />
                  )}
                </View>
                <View style={styles.meta}>
                  <Text style={styles.title} numberOfLines={2}>
                    {historyTitle(item)}
                  </Text>
                  <Text style={styles.date}>{formatDate(item.createdAt || item.created_at)}</Text>
                </View>
                <View style={styles.right}>
                  <Text style={[styles.amount, credit ? styles.amountIn : styles.amountOut]}>
                    {credit ? '+' : '−'}
                    {formatCurrency(value)}
                  </Text>
                  <AppBadge label={historyBadge(item)} />
                </View>
              </View>
            );
          }}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  balanceCard: {
    backgroundColor: colors.brand[700],
    borderRadius: radius.xl,
    padding: 18,
    marginBottom: 14,
    overflow: 'hidden',
    ...shadows.md,
  },
  blobOne: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.08)',
    top: -48,
    right: -28,
  },
  blobTwo: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.06)',
    bottom: -30,
    left: -18,
  },
  balanceTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  balanceIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceCopy: { flex: 1 },
  balanceLabel: {
    color: colors.white,
    fontWeight: '700',
    fontSize: moderateScale(13),
    letterSpacing: 0.2,
  },
  balanceHint: {
    color: colors.brand[200],
    marginTop: 2,
    fontSize: moderateScale(12),
    fontWeight: '600',
  },
  balanceValue: {
    color: colors.white,
    fontSize: moderateScale(32),
    fontWeight: '800',
    letterSpacing: 0.2,
    marginBottom: 14,
  },
  statRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  statChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  statLabel: {
    color: colors.brand[100],
    fontSize: 11,
    fontWeight: '700',
  },
  statValue: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 1,
  },
  payoutCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    minHeight: 46,
  },
  payoutCtaText: {
    color: colors.brand[800],
    fontWeight: '800',
    fontSize: moderateScale(14),
  },
  pressed: { opacity: 0.88 },
  payout: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
    ...shadows.sm,
  },
  payoutTitle: {
    fontWeight: '800',
    color: colors.text,
    fontSize: 15,
    marginBottom: 10,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: -4,
    marginBottom: 4,
  },
  count: { color: colors.muted, fontWeight: '700', fontSize: 12 },
  list: { paddingBottom: 28, gap: 10, flexGrow: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  txnIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txnIn: { backgroundColor: colors.successSoft },
  txnOut: { backgroundColor: colors.dangerSoft },
  meta: { flex: 1, minWidth: 0 },
  title: { fontWeight: '700', color: colors.text, fontSize: 14 },
  date: { color: colors.muted, marginTop: 4, fontSize: 12 },
  right: { alignItems: 'flex-end', gap: 6 },
  amount: { fontWeight: '800', fontSize: 14 },
  amountIn: { color: colors.success },
  amountOut: { color: colors.danger },
});
