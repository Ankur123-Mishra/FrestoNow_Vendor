import { apiClient } from '@/api/client';
import { endpoints } from '@/api/endpoints';
import { ENV } from '@/config/env';
import type { LoginPayload, PickedImage, RegisterPayload, RegisterStoreMedia } from '@/types';

function appendFile(form: FormData, field: string, image: PickedImage, fallbackName: string) {
  form.append(field, {
    uri: image.uri,
    type: image.type || 'image/jpeg',
    name: image.fileName || fallbackName,
  } as unknown as Blob);
}

function appendStoreMedia(body: FormData, moduleType: 'FOOD' | 'GROCERY', media?: RegisterStoreMedia) {
  if (!media) {
    return;
  }
  const prefix = moduleType === 'FOOD' ? 'food' : 'grocery';
  if (media.logo) {
    appendFile(body, `${prefix}_logo`, media.logo, `${prefix}-logo.jpg`);
  }
  if (media.cover) {
    appendFile(body, `${prefix}_cover`, media.cover, `${prefix}-cover.jpg`);
  }
  if (media.fssai) {
    appendFile(body, `${prefix}_fssai`, media.fssai, `${prefix}-fssai.jpg`);
  }
}

/** Multipart body matching the vendor website registration. */
export function buildRegisterFormData(payload: RegisterPayload): FormData {
  const body = new FormData();
  body.append('name', payload.name.trim());
  body.append('shopname', payload.shopname.trim());
  body.append('email', payload.email.trim().toLowerCase());
  body.append('phone', payload.phone.trim());
  body.append('password', payload.password);
  body.append('services', JSON.stringify(payload.services));
  if (payload.gst_no?.trim()) {
    body.append('gst_no', payload.gst_no.trim());
  }
  if (payload.eid_no?.trim()) {
    body.append('eid_no', payload.eid_no.trim());
  }
  body.append('pickup_location', payload.pickup_location.trim());
  body.append('pickup_pin_code', payload.pickup_pin_code.trim());
  body.append('bank_name', payload.bank_name.trim());
  body.append('bank_account_no', payload.bank_account_no.trim());
  body.append('bank_ifsc', payload.bank_ifsc.trim());
  if (payload.stores?.length) {
    body.append('stores', JSON.stringify(payload.stores));
  }
  if (payload.services.includes('FOOD')) {
    appendStoreMedia(body, 'FOOD', payload.foodMedia);
  }
  if (payload.services.includes('GROCERY')) {
    appendStoreMedia(body, 'GROCERY', payload.groceryMedia);
  }
  return body;
}

export const authService = {
  register(payload: RegisterPayload) {
    return apiClient.post(endpoints.auth.register, buildRegisterFormData(payload));
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
