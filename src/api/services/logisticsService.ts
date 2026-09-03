import { apiClient } from '@/api/client';
import { endpoints } from '@/api/endpoints';
import type { ManualShipmentPayload, ShiprocketPayload } from '@/types';

export const logisticsService = {
  createManualShipment(orderId: string | number, payload: ManualShipmentPayload) {
    return apiClient.post(endpoints.orders.shipments(orderId), payload);
  },

  createShiprocketShipment(orderId: string | number, payload: ShiprocketPayload) {
    return apiClient.post(endpoints.orders.shiprocket(orderId), payload);
  },

  getDeliveryTrack(orderId: string | number) {
    return apiClient.get(endpoints.delivery.track(orderId));
  },
};
