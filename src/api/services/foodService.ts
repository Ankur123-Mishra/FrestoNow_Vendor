import { apiClient } from '@/api/client';
import { endpoints } from '@/api/endpoints';
import type { FoodFulfillmentType, FoodPaymentMode } from '@/config/constants';

export interface FoodPosItem {
  productId: number | string;
  quantity: number;
}

export interface FoodItemProfilePayload {
  dietType: string;
  isSoldOut?: boolean;
  isAvailable?: boolean;
  prepTimeMins?: number;
  cuisine?: string;
  spiceLevel?: string;
  serves?: number;
  sectionId?: number;
  foodTags?: string[];
  ingredientsDescription?: string;
  allergens?: string[];
}

export const foodService = {
  getSections() {
    return apiClient.get(endpoints.food.sections);
  },

  createSection(payload: { name: string }) {
    return apiClient.post(endpoints.food.sections, payload);
  },

  saveItemProfile(productId: string | number, payload: FoodItemProfilePayload) {
    return apiClient.put(endpoints.food.itemProfile(productId), payload);
  },

  getModifierGroups() {
    return apiClient.get(endpoints.food.modifierGroups);
  },

  attachModifierGroup(itemId: string | number, groupId: string | number) {
    return apiClient.post(endpoints.food.attachModifier(itemId, groupId));
  },

  getKitchenOrders() {
    return apiClient.get(endpoints.food.kitchenOrders);
  },

  getKitchenOrder(id: string | number) {
    return apiClient.get(endpoints.food.kitchenOrderById(id));
  },

  getFloors() {
    return apiClient.get(endpoints.food.floors);
  },

  getTables() {
    return apiClient.get(endpoints.food.tables);
  },

  createTable(payload: { floorId: number | string; name: string; capacity: number }) {
    return apiClient.post(endpoints.food.tables, payload);
  },

  openCheck(tableId: string | number, payload: { covers: number; waiterId?: number | string }) {
    return apiClient.post(endpoints.food.openCheck(tableId), payload);
  },

  addTableItems(tableId: string | number, items: FoodPosItem[]) {
    return apiClient.post(endpoints.food.tableItems(tableId), { items });
  },

  settleCheck(tableId: string | number, payload: { paymentMode: FoodPaymentMode }) {
    return apiClient.post(endpoints.food.settle(tableId), payload);
  },

  createPosOrder(payload: { items: FoodPosItem[]; fulfillmentType: FoodFulfillmentType }) {
    return apiClient.post(endpoints.food.posOrders, payload);
  },

  getReservations() {
    return apiClient.get(endpoints.food.reservations);
  },

  createReservation(payload: { customerName: string; pax: number; time: string }) {
    return apiClient.post(endpoints.food.reservations, payload);
  },

  getStaff() {
    return apiClient.get(endpoints.food.staff);
  },

  openShift(payload: { openingBalance: number }) {
    return apiClient.post(endpoints.food.shiftsOpen, payload);
  },
};
