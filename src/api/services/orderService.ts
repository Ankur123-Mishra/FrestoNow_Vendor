import { apiClient } from '@/api/client';
import { endpoints } from '@/api/endpoints';
import { MODULE_TYPE } from '@/config/constants';
import type { OrderAction } from '@/config/constants';

export const orderService = {
  getAll() {
    return apiClient.get(endpoints.orders.list, {
      params: { moduleType: MODULE_TYPE, limit: 50 },
    });
  },

  getById(id: string | number) {
    return apiClient.get(endpoints.orders.byId(id));
  },

  transitionStatus(id: string | number, action: OrderAction, note?: string) {
    return apiClient.patch(endpoints.orders.status(id), { action, note });
  },
};
