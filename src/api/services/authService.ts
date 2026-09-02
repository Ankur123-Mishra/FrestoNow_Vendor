import { apiClient } from '@/api/client';
import { endpoints } from '@/api/endpoints';
import type { LoginPayload, RegisterPayload } from '@/types';

export const authService = {
  register(payload: RegisterPayload) {
    return apiClient.post(endpoints.auth.register, payload);
  },

  async login(payload: LoginPayload) {
    const url = endpoints.auth.login;
    console.log('[Login API] Request', { method: 'POST', url, body: payload });
    try {
      const response = await apiClient.post(url, payload);
      console.log('[Login API] Response', {
        status: response.status,
        data: response.data,
      });
      return response;
    } catch (error) {
      const axiosError = error as {
        message?: string;
        response?: { status?: number; data?: unknown };
      };
      console.log('[Login API] Error Response', {
        message: axiosError.message,
        status: axiosError.response?.status,
        data: axiosError.response?.data,
      });
      throw error;
    }
  },

  getMe() {
    return apiClient.get(endpoints.auth.me);
  },
};
