import { apiClient } from '@/api/client';
import { endpoints } from '@/api/endpoints';
import { MODULE_TYPE } from '@/config/constants';
import type { VendorDetails } from '@/types';

export const vendorService = {
  getMe() {
    return apiClient.get(endpoints.auth.me);
  },

  getAccount() {
    return apiClient.get(endpoints.vendor.account);
  },

  getServices() {
    return apiClient.get(endpoints.vendor.services);
  },

  updateAccount(payload: Pick<VendorDetails, 'name' | 'shopname'>) {
    return apiClient.post(endpoints.vendor.update, payload);
  },

  setOnline(isOnline: boolean, moduleType: string = MODULE_TYPE) {
    return apiClient.patch(endpoints.vendor.online, { isOnline, moduleType });
  },

  getReports() {
    return apiClient.get(endpoints.orders.reports, {
      params: { moduleType: MODULE_TYPE },
    });
  },
};
