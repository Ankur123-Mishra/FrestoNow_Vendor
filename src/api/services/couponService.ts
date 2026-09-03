import { apiClient } from '@/api/client';
import { endpoints } from '@/api/endpoints';
import { getActiveModule } from '@/store/moduleStore';
import type { CouponPayload } from '@/types';

export const couponService = {
  getAll() {
    return apiClient.get(endpoints.coupons.list, {
      params: { moduleType: getActiveModule() },
    });
  },

  create(payload: CouponPayload) {
    return apiClient.post(endpoints.coupons.list, {
      ...payload,
      moduleType: payload.moduleType || getActiveModule(),
    });
  },

  update(id: string | number, payload: Partial<CouponPayload>) {
    return apiClient.put(endpoints.coupons.byId(id), payload);
  },
};
