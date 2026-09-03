import { apiClient } from '@/api/client';
import { endpoints } from '@/api/endpoints';
import { getActiveModule } from '@/store/moduleStore';
import type { SlotTemplatePayload } from '@/types';

export const slotService = {
  getTemplates() {
    return apiClient.get(endpoints.slots.templates, {
      params: { moduleType: getActiveModule() },
    });
  },

  createTemplate(payload: SlotTemplatePayload) {
    return apiClient.post(endpoints.slots.templates, payload);
  },
};
