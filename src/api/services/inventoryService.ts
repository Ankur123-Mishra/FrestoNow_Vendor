import { apiClient } from '@/api/client';
import { endpoints } from '@/api/endpoints';
import { getActiveModule } from '@/store/moduleStore';
import type { InventoryPayload } from '@/types';

export const inventoryService = {
  getAll() {
    return apiClient.get(endpoints.inventory.list, {
      params: { moduleType: getActiveModule() },
    });
  },

  update(id: string | number, payload: InventoryPayload) {
    return apiClient.patch(endpoints.inventory.update(id), payload);
  },
};
