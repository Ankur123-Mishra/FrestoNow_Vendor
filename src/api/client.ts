import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { ENV } from '@/config/env';
import { tokenBridge } from '@/api/tokenBridge';

export const apiClient = axios.create({
  baseURL: ENV.API_BASE_URL,
  timeout: ENV.REQUEST_TIMEOUT_MS,
  headers: {
    Accept: 'application/json',
  },
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenBridge.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const data = config.data as { constructor?: { name?: string } } | FormData | undefined;
  const isFormData =
    typeof FormData !== 'undefined' &&
    (data instanceof FormData || data?.constructor?.name === 'FormData');
  if (isFormData) {
    config.headers.delete('Content-Type');
  } else if (!config.headers['Content-Type']) {
    config.headers['Content-Type'] = 'application/json';
  }
  return config;
});

apiClient.interceptors.response.use(
  response => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      await tokenBridge.notifyUnauthorized();
    }
    return Promise.reject(error);
  },
);
