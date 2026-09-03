import { apiClient } from '@/api/client';
import { endpoints } from '@/api/endpoints';
import { getActiveModule } from '@/store/moduleStore';

export const categoryService = {
  getAll() {
    return apiClient.get(endpoints.catalog.categories, {
      params: { moduleType: getActiveModule() },
    });
  },
};

export const brandService = {
  getAll(activeOnly = true) {
    return apiClient.get(endpoints.brands, {
      params: { moduleType: getActiveModule(), activeOnly },
    });
  },
};
