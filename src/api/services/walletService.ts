import { apiClient } from '@/api/client';
import { endpoints } from '@/api/endpoints';

function createIdempotencyKey() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
    const random = (Math.random() * 16) | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export const walletService = {
  getBalance() {
    return apiClient.get(endpoints.wallet.balance);
  },

  getHistory() {
    return apiClient.get(endpoints.wallet.history);
  },

  requestPayout(amount: number, reason: string) {
    return apiClient.post(
      endpoints.finance.payouts,
      { amount, reason },
      { headers: { 'Idempotency-Key': createIdempotencyKey() } },
    );
  },
};
