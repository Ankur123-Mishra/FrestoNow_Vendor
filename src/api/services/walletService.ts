import { apiClient } from '@/api/client';
import { endpoints } from '@/api/endpoints';
import { asArray, unwrapPayload } from '@/utils/apiHelpers';
import type { WalletHistoryItem } from '@/types';

function createIdempotencyKey() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
    const random = (Math.random() * 16) | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function extractHistoryList(payload: unknown): WalletHistoryItem[] {
  if (!payload) {
    return [];
  }
  const nested = unwrapPayload(payload) as Record<string, unknown> | unknown;
  if (Array.isArray(nested)) {
    return nested as WalletHistoryItem[];
  }
  if (nested && typeof nested === 'object') {
    const obj = nested as Record<string, unknown>;
    if (Array.isArray(obj.entries)) {
      return obj.entries as WalletHistoryItem[];
    }
    if (Array.isArray(obj.history)) {
      return obj.history as WalletHistoryItem[];
    }
  }
  return asArray<WalletHistoryItem>(payload);
}

export const walletService = {
  getBalance() {
    return apiClient.get(endpoints.wallet.balance);
  },

  getSummary() {
    return apiClient.get(endpoints.wallet.summary);
  },

  getFinanceBalance() {
    return apiClient.get(endpoints.finance.balance);
  },

  getLedger() {
    return apiClient.get(endpoints.finance.ledger);
  },

  getWalletHistory(params?: { page?: number; limit?: number }) {
    return apiClient.get(endpoints.wallet.history, { params });
  },

  /**
   * Prefer finance ledger entries (same as web Overview).
   * If ledger is empty or unavailable, fall back to /wallet/history.
   */
  async getHistory() {
    const [ledgerResult, historyResult] = await Promise.allSettled([
      apiClient.get(endpoints.finance.ledger, { params: { limit: 50, offset: 0 } }),
      apiClient.get(endpoints.wallet.history, { params: { page: 1, limit: 50 } }),
    ]);

    const ledgerEntries =
      ledgerResult.status === 'fulfilled'
        ? extractHistoryList(ledgerResult.value.data)
        : [];
    if (ledgerEntries.length > 0) {
      return { data: { entries: ledgerEntries }, source: 'ledger' as const };
    }

    const historyEntries =
      historyResult.status === 'fulfilled'
        ? extractHistoryList(historyResult.value.data)
        : [];
    if (historyEntries.length > 0) {
      return { data: { history: historyEntries }, source: 'wallet' as const };
    }

    if (ledgerResult.status === 'rejected' && historyResult.status === 'rejected') {
      throw ledgerResult.reason ?? historyResult.reason;
    }

    return { data: { history: [] }, source: 'wallet' as const };
  },

  requestPayout(amount: number, reason?: string) {
    return apiClient.post(
      endpoints.finance.payouts,
      reason ? { amount, reason } : { amount },
      { headers: { 'Idempotency-Key': createIdempotencyKey() } },
    );
  },
};
