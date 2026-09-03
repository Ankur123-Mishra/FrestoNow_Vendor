import { apiClient } from '@/api/client';
import { endpoints } from '@/api/endpoints';
import { ENV } from '@/config/env';
import type { LoginPayload, RegisterPayload } from '@/types';

export const authService = {
  register(payload: RegisterPayload) {
    return apiClient.post(endpoints.auth.register, payload);
  },

  async login(payload: LoginPayload) {
    const url = `${ENV.API_BASE_URL}${endpoints.auth.login}`;
    console.log('========== LOGIN API ==========');
    console.log('URL:', url);
    console.log('PAYLOAD:', JSON.stringify(payload, null, 2));
    try {
      const response = await apiClient.post(endpoints.auth.login, payload);
      console.log('RESPONSE STATUS:', response.status);
      console.log('RESPONSE:', JSON.stringify(response.data, null, 2));
      console.log('================================');
      return response;
    } catch (error) {
      const axiosError = error as {
        message?: string;
        response?: { status?: number; data?: unknown };
      };
      console.log('ERROR STATUS:', axiosError.response?.status);
      console.log('ERROR RESPONSE:', JSON.stringify(axiosError.response?.data ?? axiosError.message, null, 2));
      console.log('================================');
      throw error;
    }
  },

  getMe() {
    return apiClient.get(endpoints.auth.me);
  },
};
