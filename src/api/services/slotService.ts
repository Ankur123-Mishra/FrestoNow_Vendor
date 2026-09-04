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

  updateTemplate(id: string | number, payload: Partial<SlotTemplatePayload>) {
    return apiClient.patch(endpoints.slots.templateById(id), payload);
  },

  deleteTemplate(id: string | number) {
    return apiClient.delete(endpoints.slots.templateById(id));
  },

  getUpcoming(days = 7) {
    return apiClient.get(endpoints.slots.vendor, {
      params: { days, moduleType: getActiveModule() },
    });
  },
};
