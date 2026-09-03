import { apiClient } from '@/api/client';
import { endpoints } from '@/api/endpoints';
import type { FoodFulfillmentType, FoodPaymentMode } from '@/config/constants';

export interface FoodPosItem {
  productId: number | string;
  quantity: number;
  variantId?: number | string;
  note?: string;
  modifierOptionIds?: number[];
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

export type FoodTableStatus = 'FREE' | 'OCCUPIED' | 'BILLING' | 'RESERVED' | 'CLEANING';

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

  createFloor(payload: { name: string; sortOrder?: number }) {
    return apiClient.post(endpoints.food.floors, payload);
  },

  getTables() {
    return apiClient.get(endpoints.food.tables);
  },

  createTable(payload: { floorId: number | string; code: string; capacity: number }) {
    return apiClient.post(endpoints.food.tables, payload);
  },

  updateTable(
    tableId: string | number,
    payload: {
      status?: FoodTableStatus;
      code?: string;
      capacity?: number;
      isActive?: boolean;
      floorId?: number | string;
    },
  ) {
    return apiClient.patch(endpoints.food.tableById(tableId), payload);
  },

  issueTableQr(tableId: string | number, rotate?: boolean) {
    return apiClient.post(endpoints.food.tableQr(tableId), rotate ? { rotate: true } : {});
  },

  openCheck(
    tableId: string | number,
    payload: {
      covers?: number;
      waiterId?: number | string;
      waiterName?: string;
      guestName?: string;
      guestPhone?: string;
      notes?: string;
      version?: number;
      items: FoodPosItem[];
    },
  ) {
    return apiClient.post(endpoints.food.openCheck(tableId), payload);
  },

  addTableItems(tableId: string | number, items: FoodPosItem[]) {
    return apiClient.post(endpoints.food.tableItems(tableId), { items });
  },

  settleCheck(
    tableId: string | number,
    payload: {
      paymentMethod: FoodPaymentMode;
      paymentReference?: string;
      version?: number;
      orderId?: number | string;
      discount?: number;
      tipAmount?: number;
      serviceCharge?: number;
    },
  ) {
    return apiClient.post(endpoints.food.settle(tableId), payload);
  },

  cancelCheck(tableId: string | number, payload?: { version?: number; reason?: string }) {
    return apiClient.post(endpoints.food.cancelCheck(tableId), payload ?? {});
  },

  markTableCleaned(tableId: string | number, payload?: { version?: number }) {
    return apiClient.post(endpoints.food.markCleaned(tableId), payload ?? {});
  },

  assignWaiter(
    tableId: string | number,
    payload: { waiterName?: string; waiterId?: number | string },
  ) {
    return apiClient.patch(endpoints.food.tableWaiter(tableId), payload);
  },

  createPosOrder(payload: { items: FoodPosItem[]; fulfillmentType: FoodFulfillmentType }) {
    return apiClient.post(endpoints.food.posOrders, payload);
  },

  getReservations(params?: { status?: string }) {
    return apiClient.get(endpoints.food.reservations, { params });
  },

  createReservation(payload: {
    guestName: string;
    guestPhone: string;
    partySize?: number;
    reservedAt: string;
    tableId?: number | string;
    notes?: string;
  }) {
    return apiClient.post(endpoints.food.reservations, payload);
  },

  seatReservation(
    id: string | number,
    payload?: { tableId?: number | string; guestPhone?: string },
  ) {
    return apiClient.post(endpoints.food.seatReservation(id), payload ?? {});
  },

  updateReservation(
    id: string | number,
    payload: { status?: string; reason?: string; guestName?: string; guestPhone?: string },
  ) {
    return apiClient.patch(endpoints.food.reservationById(id), payload);
  },

  getStaff() {
    return apiClient.get(endpoints.food.staff);
  },

  getWaiters() {
    return apiClient.get(endpoints.food.waiters);
  },

  openShift(payload: { openingBalance: number }) {
    return apiClient.post(endpoints.food.shiftsOpen, payload);
  },
};
