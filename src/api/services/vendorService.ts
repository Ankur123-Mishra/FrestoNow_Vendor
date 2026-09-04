import { apiClient } from '@/api/client';
import { endpoints } from '@/api/endpoints';
import { getActiveModule } from '@/store/moduleStore';
import type { PickedImage, VendorAccount, VendorDetails } from '@/types';

export interface StoreProfilePayload {
  moduleType?: string;
  displayName?: string;
  phone?: string;
  contactPhone?: string;
  whatsappPhone?: string;
  secondaryPhone?: string;
  address?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  openTime?: string;
  closeTime?: string;
  minOrderValue?: number | string | null;
  packagingCharge?: number | string | null;
  deliveryRadiusKm?: number | string | null;
  avgPrepTimeMins?: number | string | null;
  storeType?: string;
  fssaiLicenseNo?: string;
  hasColdStorage?: boolean;
  expressDelivery?: boolean;
  baseDeliveryFee?: number | string | null;
  temporaryClosedUntil?: string | null;
  weeklyHours?: unknown;
  documents?: unknown;
  metadata?: unknown;
  [key: string]: unknown;
}

export interface StoreMediaFiles {
  image?: PickedImage | null;
  coverImage?: PickedImage | null;
  fssaiDocument?: PickedImage | null;
}

export interface AccountUpdatePayload {
  name?: string;
  shopname?: string;
  phone?: string;
  gst_no?: string;
  eid_no?: string;
  pickup_location?: string;
  pickup_pin_code?: string;
  bank_name?: string;
  bank_account_no?: string;
  bank_ifsc?: string;
}

function appendFile(form: FormData, field: string, image: PickedImage, fallbackName: string) {
  form.append(field, {
    uri: image.uri,
    type: image.type || 'image/jpeg',
    name: image.fileName || fallbackName,
  } as unknown as Blob);
}

/** Build multipart body matching the vendor web Store page. */
export function buildStoreFormData(payload: StoreProfilePayload, files: StoreMediaFiles = {}) {
  const body = new FormData();
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) {
      continue;
    }
    body.append(
      key,
      value != null && typeof value === 'object'
        ? JSON.stringify(value)
        : value == null
          ? ''
          : String(value),
    );
  }
  if (files.image) {
    appendFile(body, 'image', files.image, 'store-logo.jpg');
  }
  if (files.coverImage) {
    appendFile(body, 'coverImage', files.coverImage, 'store-cover.jpg');
  }
  if (files.fssaiDocument) {
    appendFile(body, 'fssaiDocument', files.fssaiDocument, 'fssai-document.jpg');
  }
  return body;
}

export const vendorService = {
  getMe() {
    return apiClient.get(endpoints.auth.me);
  },

  getStoreProfile(moduleType: string = getActiveModule()) {
    return apiClient.get(endpoints.vendor.update, {
      params: { moduleType },
    });
  },

  upsertStore(payload: StoreProfilePayload | FormData) {
    return apiClient.post(endpoints.vendor.update, payload);
  },

  getAccount() {
    return apiClient.get(endpoints.vendor.account);
  },

  getServices() {
    return apiClient.get(endpoints.vendor.services);
  },

  updateAccount(payload: AccountUpdatePayload | Pick<VendorDetails, 'name' | 'shopname' | 'gst_no'>) {
    return apiClient.patch(endpoints.vendor.account, payload);
  },

  /** Legacy shop-name update used by older screens. */
  updateStoreBasic(payload: Pick<VendorDetails, 'name' | 'shopname' | 'gst_no'>) {
    return apiClient.post(endpoints.vendor.update, payload);
  },

  setOnline(isOnline: boolean, moduleType: string = getActiveModule()) {
    return apiClient.patch(endpoints.vendor.online, { isOnline, moduleType });
  },

  getReports(
    moduleType: string = getActiveModule(),
    range?: { from?: string; to?: string },
  ) {
    return apiClient.get(endpoints.orders.reports, {
      params: {
        moduleType,
        ...(range?.from ? { from: range.from } : {}),
        ...(range?.to ? { to: range.to } : {}),
      },
    });
  },
};

export type { VendorAccount };
