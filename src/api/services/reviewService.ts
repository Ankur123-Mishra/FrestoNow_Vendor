import { apiClient } from '@/api/client';
import { endpoints } from '@/api/endpoints';
import { getActiveModule } from '@/store/moduleStore';

export const reviewService = {
  getProductReviews(params?: { page?: number; limit?: number; moduleType?: string }) {
    return apiClient.get(endpoints.reviews.product, {
      params: {
        moduleType: params?.moduleType || getActiveModule(),
        page: params?.page ?? 1,
        limit: params?.limit ?? 40,
      },
    });
  },

  getOrderReviews(params?: { vendorId?: string | number; page?: number; limit?: number }) {
    return apiClient.get(endpoints.reviews.order, {
      params: {
        vendorId: params?.vendorId,
        page: params?.page ?? 1,
        limit: params?.limit ?? 40,
      },
    });
  },
};
