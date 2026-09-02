import { apiClient } from '@/api/client';
import { endpoints } from '@/api/endpoints';
import { MODULE_TYPE } from '@/config/constants';
import type { InventoryPayload } from '@/types';

export const inventoryService = {
  getAll() {
    return apiClient.get(endpoints.inventory.list, {
      params: { moduleType: MODULE_TYPE },
    });
  },

  update(id: string | number, payload: InventoryPayload) {
    return apiClient.patch(endpoints.inventory.update(id), payload);
  },
};
