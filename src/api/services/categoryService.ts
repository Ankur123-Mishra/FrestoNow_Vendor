import { apiClient } from '@/api/client';
import { endpoints } from '@/api/endpoints';
import { MODULE_TYPE } from '@/config/constants';

export const categoryService = {
  getAll() {
    return apiClient.get(endpoints.catalog.categories, {
      params: { moduleType: MODULE_TYPE },
    });
  },
};

export const brandService = {
  getAll(activeOnly = true) {
    return apiClient.get(endpoints.brands, {
      params: { moduleType: MODULE_TYPE, activeOnly },
    });
  },
};
