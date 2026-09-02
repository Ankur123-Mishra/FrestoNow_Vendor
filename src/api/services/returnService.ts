import { apiClient } from '@/api/client';
import { endpoints } from '@/api/endpoints';
import { MODULE_TYPE } from '@/config/constants';
import type { ReturnAction } from '@/config/constants';
import type { PosRefundScope } from '@/config/constants';

export const returnService = {
  getAll() {
    return apiClient.get(endpoints.returns.list, {
      params: { moduleType: MODULE_TYPE },
    });
  },

  decide(returnRequestId: number | string, action: ReturnAction, note?: string) {
    return apiClient.post(endpoints.returns.decide, {
      returnRequestId,
      action,
      note,
    });
  },

  posRefund(orderId: number | string, scope: PosRefundScope, reason: string) {
    return apiClient.post(endpoints.returns.posRefund, {
      orderId,
      scope,
      reason,
    });
  },
};
