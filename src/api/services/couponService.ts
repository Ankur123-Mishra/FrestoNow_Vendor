import { apiClient } from '@/api/client';
import { endpoints } from '@/api/endpoints';
import { MODULE_TYPE } from '@/config/constants';
import type { CouponPayload } from '@/types';

export const couponService = {
  getAll() {
    return apiClient.get(endpoints.coupons.list, {
      params: { moduleType: MODULE_TYPE },
    });
  },

  create(payload: CouponPayload) {
    return apiClient.post(endpoints.coupons.list, {
      ...payload,
      moduleType: MODULE_TYPE,
    });
  },

  update(id: string | number, payload: Partial<CouponPayload>) {
    return apiClient.put(endpoints.coupons.byId(id), payload);
  },
};
