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
  isPreorder?: boolean;
  availableFrom?: string;
  availableUntil?: string;
  prepTimeMins?: number;
  cuisine?: string;
  spiceLevel?: string;
  serves?: number;
  sectionId?: number;
  calories?: number | null;
  protein?: number | null;
  carbohydrates?: number | null;
  fat?: number | null;
  foodTags?: string[];
  ingredients?: Array<{
    id: number;
    name: string;
    isIncluded: boolean;
    isRemovable: boolean;
    sortOrder: number;
    isActive: boolean;
  }>;
  ingredientsDescription?: string;
  allergens?: string[];
  attributes?: Record<string, string>;
  itemType?: 'SINGLE' | 'COMBO';
  comboItems?: Array<{ productId: number; quantity: number; name?: string }>;
}

export type FoodTableStatus = 'FREE' | 'OCCUPIED' | 'BILLING' | 'RESERVED' | 'CLEANING';

export interface ModifierOptionInput {
  name: string;
  price?: number;
  dietaryType?: string;
  isDefault?: boolean;
  isActive?: boolean;
}

export interface ModifierGroupPayload {
  name: string;
  description?: string | null;
  selectionType?: string;
  required?: boolean;
  minSelect?: number;
  maxSelect?: number;
  options?: ModifierOptionInput[];
  isActive?: boolean;
  sortOrder?: number;
}

export type FoodSectionPayload =
  | FormData
  | {
      name?: string;
      description?: string | null;
      sortOrder?: number;
      isActive?: boolean;
      icon?: string | null;
    };

export interface StaffPayload {
  name: string;
  role: string;
  email?: string;
  phone?: string;
  password?: string;
  status?: string;
}

export const foodService = {
  getSections() {
    return apiClient.get(endpoints.food.sections);
  },

  createSection(payload: FoodSectionPayload) {
    return apiClient.post(endpoints.food.sections, payload);
  },

  updateSection(id: string | number, payload: FoodSectionPayload) {
    return apiClient.put(endpoints.food.sectionById(id), payload);
  },

  saveItemProfile(productId: string | number, payload: FoodItemProfilePayload) {
    return apiClient.put(endpoints.food.itemProfile(productId), payload);
  },

  getModifierGroups() {
    return apiClient.get(endpoints.food.modifierGroups);
  },

  createModifierGroup(payload: ModifierGroupPayload) {
    return apiClient.post(endpoints.food.modifierGroups, payload);
  },

  updateModifierGroup(id: string | number, payload: Partial<ModifierGroupPayload>) {
    return apiClient.put(endpoints.food.modifierGroupById(id), payload);
  },

  attachModifierGroup(
    itemId: string | number,
    groupId: string | number,
    payload?: {
      required?: boolean;
      minSelect?: number;
      maxSelect?: number;
      selectionType?: string;
    },
  ) {
    return apiClient.put(endpoints.food.attachModifier(itemId, groupId), payload ?? {});
  },

  detachModifierGroup(itemId: string | number, groupId: string | number) {
    return apiClient.delete(endpoints.food.attachModifier(itemId, groupId));
  },

  getAttributes() {
    return apiClient.get(endpoints.food.attributes);
  },

  createAttribute(payload: { name: string; options: Array<{ name: string }>; categoryIds?: Array<number | string> }) {
    return apiClient.post(endpoints.food.attributes, payload);
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

  /** Void a line while ORDERED | PROCESSING only. */
  voidTableItem(
    tableId: string | number,
    itemId: string | number,
    payload?: { reason?: string },
  ) {
    return apiClient.delete(endpoints.food.tableItemById(tableId, itemId), {
      data: payload ?? { reason: 'Guest changed mind' },
    });
  },

  settleCheck(
    tableId: string | number,
    payload: {
      paymentMethod?: FoodPaymentMode;
      paymentReference?: string;
      version?: number;
      orderId?: number | string;
      discount?: number;
      tipAmount?: number;
      serviceCharge?: number;
      payments?: Array<{ method: FoodPaymentMode; amount: number; reference?: string }>;
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

  adjustBill(
    orderId: string | number,
    payload: {
      discount?: number;
      discountType?: 'FLAT' | 'PERCENT';
      discountReason?: string;
      tipAmount?: number;
      serviceCharge?: number;
    },
  ) {
    return apiClient.patch(endpoints.food.billingOrder(orderId), payload);
  },

  previewBill(
    orderId: string | number,
    payload?: {
      discount?: number;
      discountType?: 'FLAT' | 'PERCENT';
      tipAmount?: number;
      serviceCharge?: number;
    },
  ) {
    return apiClient.post(endpoints.food.billingPreview(orderId), payload ?? {});
  },

  getBillingReceipt(orderId: string | number) {
    return apiClient.get(endpoints.food.billingReceipt(orderId));
  },

  createPosOrder(payload: {
    items: FoodPosItem[];
    /** ROS counter channel — prefer over legacy fulfillmentType. */
    orderChannel?: 'TAKEAWAY' | 'SELF_PICKUP' | FoodFulfillmentType;
    fulfillmentType?: FoodFulfillmentType;
    paymentMethod?: string;
    paymentReference?: string;
    guestName?: string;
    guestPhone?: string;
    discount?: number;
    tipAmount?: number;
    serviceCharge?: number;
    note?: string;
    notes?: string;
    payments?: Array<{ method: string; amount: number; reference?: string }>;
  }) {
    const orderChannel =
      payload.orderChannel ??
      (payload.fulfillmentType === 'DELIVERY'
        ? 'ONLINE_DELIVERY'
        : payload.fulfillmentType === 'DINE_IN'
          ? 'DINE_IN'
          : 'TAKEAWAY');
    const { fulfillmentType: _legacy, note, ...rest } = payload;
    return apiClient.post(endpoints.food.posOrders, {
      ...rest,
      orderChannel,
      notes: rest.notes ?? note,
    });
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

  getStaffRoles() {
    return apiClient.get(endpoints.food.staffRoles);
  },

  getWaiters() {
    return apiClient.get(endpoints.food.waiters);
  },

  createStaff(payload: StaffPayload) {
    return apiClient.post(endpoints.food.staff, payload);
  },

  updateStaff(id: string | number, payload: Partial<StaffPayload>) {
    return apiClient.patch(endpoints.food.staffById(id), payload);
  },

  deleteStaff(id: string | number) {
    return apiClient.delete(endpoints.food.staffById(id));
  },

  getCurrentShift() {
    return apiClient.get(endpoints.food.shiftsCurrent);
  },

  getShifts(limit = 20) {
    return apiClient.get(endpoints.food.shifts, { params: { limit } });
  },

  openShift(payload: { openingBalance?: number; openingFloat?: number; notes?: string }) {
    const body = {
      openingFloat: payload.openingFloat ?? payload.openingBalance ?? 0,
      notes: payload.notes,
    };
    return apiClient.post(endpoints.food.shiftsOpen, body);
  },

  closeShift(
    shiftId: string | number,
    payload: { closingFloat?: number; force?: boolean; notes?: string },
  ) {
    return apiClient.post(endpoints.food.shiftClose(shiftId), payload);
  },

  getShiftReport(shiftId: string | number) {
    return apiClient.get(endpoints.food.shiftReport(shiftId));
  },

  getCashMovements(shiftId: string | number) {
    return apiClient.get(endpoints.food.shiftCashMovements(shiftId));
  },

  addCashMovement(
    shiftId: string | number,
    payload: { type: 'PAY_IN' | 'PAY_OUT'; amount: number; reason?: string },
  ) {
    return apiClient.post(endpoints.food.shiftCashMovements(shiftId), payload);
  },
};
