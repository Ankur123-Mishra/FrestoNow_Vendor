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

  /** Quick stock adjust — absolute `stock` and/or relative `delta` (same as website Menu Availability). */
  adjust(variantId: string | number, payload: { stock?: number; delta?: number }) {
    return apiClient.patch(endpoints.inventory.update(variantId), payload);
  },
};
