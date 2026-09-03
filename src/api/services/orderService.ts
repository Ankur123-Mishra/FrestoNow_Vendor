import { apiClient } from '@/api/client';
import { endpoints } from '@/api/endpoints';
import { ENV } from '@/config/env';
import { FOOD_KITCHEN_ACTIONS } from '@/config/constants';
import { getActiveModule } from '@/store/moduleStore';
import type { ModuleType } from '@/config/constants';

function orderDetailPath(id: string | number, moduleType: ModuleType) {
  if (moduleType === 'GROCERY') {
    return endpoints.orders.groceryById(id);
  }
  if (moduleType === 'FOOD') {
    return endpoints.orders.foodById(id);
  }
  return endpoints.orders.byId(id);
}

function isKitchenAction(action: string) {
  return FOOD_KITCHEN_ACTIONS.includes(action.toUpperCase() as (typeof FOOD_KITCHEN_ACTIONS)[number]);
}

export const orderService = {
  getAll(params?: { status?: string; orderChannel?: string; limit?: number }) {
    return apiClient.get(endpoints.orders.list, {
      params: {
        moduleType: getActiveModule(),
        limit: params?.limit ?? 50,
        ...(params?.status ? { status: params.status } : {}),
        ...(params?.orderChannel ? { orderChannel: params.orderChannel } : {}),
      },
    });
  },

  async getById(id: string | number) {
    const moduleType = getActiveModule();
    const path = orderDetailPath(id, moduleType);
    const url = `${ENV.API_BASE_URL}${path}`;
    console.log('========== ORDER DETAIL API ==========');
    console.log('MODULE:', moduleType);
    console.log('METHOD: GET');
    console.log('URL:', url);
    console.log('ORDER ID:', id);
    try {
      const response = await apiClient.get(path);
      console.log('RESPONSE STATUS:', response.status);
      console.log('RESPONSE:', JSON.stringify(response.data, null, 2));
      console.log('======================================');
      return response;
    } catch (error) {
      const axiosError = error as {
        message?: string;
        response?: { status?: number; data?: unknown };
      };
      console.log('ERROR STATUS:', axiosError.response?.status);
      console.log(
        'ERROR RESPONSE:',
        JSON.stringify(axiosError.response?.data ?? axiosError.message, null, 2),
      );
      console.log('======================================');
      throw error;
    }
  },

  transitionStatus(
    id: string | number,
    action: string,
    note?: string,
    extras?: { prepTimeMins?: number },
  ) {
    const moduleType = getActiveModule();
    const body: Record<string, unknown> = { action, note };
    if (extras?.prepTimeMins != null) {
      body.prepTimeMins = extras.prepTimeMins;
    }

    if (moduleType === 'FOOD' && isKitchenAction(action)) {
      return apiClient.patch(endpoints.food.kitchenOrderById(id), {
        ...body,
        reason: action.toUpperCase() === 'REJECT' ? note : undefined,
      });
    }
    if (moduleType === 'FOOD') {
      return apiClient.patch(endpoints.orders.foodStatus(id), body);
    }
    if (moduleType === 'GROCERY') {
      return apiClient.patch(endpoints.orders.groceryStatus(id), body);
    }
    return apiClient.patch(endpoints.orders.status(id), body);
  },
};
