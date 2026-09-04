import { apiClient } from '@/api/client';
import { endpoints } from '@/api/endpoints';
import { getActiveModule } from '@/store/moduleStore';
import type { PickedImage, ProductPayload } from '@/types';

function appendFile(form: FormData, field: string, image: PickedImage, fallbackName: string) {
  form.append(field, {
    uri: image.uri,
    type: image.type || 'image/jpeg',
    name: image.fileName || fallbackName,
  } as unknown as Blob);
}

function appendIfValue(form: FormData, key: string, value?: string | number | null) {
  if (value === undefined || value === null) {
    return;
  }
  const text = String(value).trim();
  if (!text) {
    return;
  }
  form.append(key, text);
}

function appendProductForm(
  form: FormData,
  payload: ProductPayload,
  thumbnail?: PickedImage | null,
  images?: Array<PickedImage | null | undefined>,
  includeModuleType = true,
) {
  form.append('name', payload.name);
  form.append('categoryId', payload.categoryId);
  if (includeModuleType) {
    form.append('moduleType', getActiveModule());
  }
  appendIfValue(form, 'brandId', payload.brandId);
  appendIfValue(form, 'description', payload.description);
  appendIfValue(form, 'keywords', payload.keywords);
  appendIfValue(form, 'tags', payload.tags);
  appendIfValue(form, 'meta_title', payload.meta_title);
  appendIfValue(form, 'meta_description', payload.meta_description);
  appendIfValue(form, 'meta_robots', payload.meta_robots);
  appendIfValue(form, 'canonical_url', payload.canonical_url);
  appendIfValue(form, 'minimum_order_quantity', payload.minimum_order_quantity);
  appendIfValue(form, 'maximum_order_quantity', payload.maximum_order_quantity);
  form.append('productOptions', JSON.stringify(payload.productOptions ?? []));
  form.append('productSpecs', JSON.stringify(payload.productSpecs ?? []));
  form.append('variants', JSON.stringify(payload.variants ?? []));
  if (payload.groceryProfile) {
    form.append('groceryProfile', JSON.stringify(payload.groceryProfile));
  }
  if (thumbnail?.uri) {
    appendFile(form, 'thumbnail_img', thumbnail, 'thumbnail.jpg');
  }
  images?.forEach((image, index) => {
    if (image?.uri) {
      appendFile(form, `images_${index}`, image, `variant_${index}.jpg`);
    }
  });
}

function logProductApiError(label: string, error: unknown) {
  const axiosError = error as {
    message?: string;
    response?: { status?: number; data?: unknown };
  };
  console.log(`[${label}] Error Response`, {
    message: axiosError.message,
    status: axiosError.response?.status,
    data: axiosError.response?.data,
  });
}

export const productService = {
  async add(
    payload: ProductPayload,
    thumbnail?: PickedImage | null,
    images?: Array<PickedImage | null | undefined>,
  ) {
    const url = endpoints.catalog.products;
    const form = new FormData();
    appendProductForm(form, payload, thumbnail, images, true);
    console.log('[Add Product API] Request', {
      method: 'POST',
      url,
      payload,
      moduleType: getActiveModule(),
      variants: payload.variants,
    });
    try {
      const response = await apiClient.post(url, form);
      console.log('[Add Product API] Response', {
        status: response.status,
        data: response.data,
      });
      return response;
    } catch (error) {
      logProductApiError('Add Product API', error);
      throw error;
    }
  },

  async update(
    id: string | number,
    payload: ProductPayload,
    thumbnail?: PickedImage | null,
    images?: Array<PickedImage | null | undefined>,
  ) {
    const url = endpoints.catalog.productById(id);
    const form = new FormData();
    appendProductForm(form, payload, thumbnail, images, false);
    console.log('[Update Product API] Request', {
      method: 'PUT',
      url,
      payload,
      variants: payload.variants,
    });
    try {
      const response = await apiClient.put(url, form);
      console.log('[Update Product API] Response', {
        status: response.status,
        data: response.data,
      });
      return response;
    } catch (error) {
      logProductApiError('Update Product API', error);
      throw error;
    }
  },

  getMine(params?: { is_active?: boolean; limit?: number }) {
    return apiClient.get(endpoints.catalog.products, {
      params: {
        moduleType: getActiveModule(),
        limit: params?.limit ?? 50,
        ...(params?.is_active != null ? { is_active: params.is_active } : {}),
      },
    });
  },

  getById(id: string | number) {
    return apiClient.get(endpoints.catalog.productById(id), {
      params: { moduleType: getActiveModule() },
    });
  },

  updateStatus(id: string | number, is_active: boolean) {
    return apiClient.patch(endpoints.catalog.productStatus(id), { is_active });
  },
};
