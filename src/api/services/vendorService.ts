import { apiClient } from '@/api/client';
import { endpoints } from '@/api/endpoints';
import { getActiveModule } from '@/store/moduleStore';
import type { VendorDetails } from '@/types';

export const vendorService = {
  getMe() {
    return apiClient.get(endpoints.auth.me);
  },

  getStoreProfile() {
    return apiClient.get(endpoints.vendor.update);
  },

  getAccount() {
    return apiClient.get(endpoints.vendor.account);
  },

  getServices() {
    return apiClient.get(endpoints.vendor.services);
  },

  updateAccount(payload: Pick<VendorDetails, 'name' | 'shopname' | 'gst_no'>) {
    return apiClient.post(endpoints.vendor.update, payload);
  },

  setOnline(isOnline: boolean, moduleType: string = getActiveModule()) {
    return apiClient.patch(endpoints.vendor.online, { isOnline, moduleType });
  },

  getReports(moduleType: string = getActiveModule()) {
    return apiClient.get(endpoints.orders.reports, {
      params: { moduleType },
    });
  },
};
