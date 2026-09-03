/**
 * Paths are relative to ENV.API_BASE_URL (https://frestonow.com/api).
 * Module-wise vendor APIs: E-Commerce, Grocery, and Food (ROS).
 */
export const endpoints = {
  auth: {
    register: '/auth/vendor/register',
    login: '/auth/vendor/login',
    me: '/auth/me',
  },
  vendor: {
    account: '/platform/vendors/account',
    services: '/platform/vendors/me/services',
    update: '/platform/vendors/me',
    online: '/platform/vendors/me/online',
  },
  catalog: {
    products: '/platform/catalog/vendor/products',
    productById: (id: string | number) => `/platform/catalog/vendor/products/${id}`,
    productStatus: (id: string | number) => `/platform/catalog/vendor/products/${id}/status`,
    categories: '/platform/catalog/vendor/categories',
  },
  brands: '/platform/brands',
  orders: {
    list: '/platform/orders/vendor',
    reports: '/platform/orders/vendor/reports',
    byId: (id: string | number) => `/ecommerce/orders/${id}`,
    groceryById: (id: string | number) => `/grocery/orders/${id}`,
    foodById: (id: string | number) => `/food/orders/${id}`,
    status: (id: string | number) => `/platform/orders/vendor/${id}/status`,
    groceryStatus: (id: string | number) => `/grocery/orders/${id}/status`,
    foodStatus: (id: string | number) => `/food/orders/${id}/status`,
    shipments: (id: string | number) => `/ecommerce/orders/${id}/shipments`,
    shiprocket: (id: string | number) => `/platform/orders/vendor/${id}/shiprocket`,
  },
  delivery: {
    track: (id: string | number) => `/delivery/track/${id}`,
  },
  inventory: {
    list: '/platform/inventory/vendor',
    update: (id: string | number) => `/platform/inventory/vendor/${id}`,
  },
  slots: {
    vendor: '/platform/slots/vendor',
    templates: '/platform/slots/vendor/templates',
  },
  returns: {
    list: '/platform/returns/vendor',
    decide: '/platform/returns/vendor/decide',
    posRefund: '/platform/returns/vendor/pos-refund',
  },
  coupons: {
    list: '/platform/coupons/vendor',
    byId: (id: string | number) => `/platform/coupons/vendor/${id}`,
  },
  wallet: {
    history: '/wallet/history',
    balance: '/wallet/balance',
  },
  finance: {
    ledger: '/finance/ledger',
    payouts: '/finance/payouts',
  },
  food: {
    sections: '/food/vendor/sections',
    sectionById: (id: string | number) => `/food/vendor/sections/${id}`,
    modifierGroups: '/food/vendor/modifier-groups',
    attachModifier: (itemId: string | number, groupId: string | number) =>
      `/food/vendor/items/${itemId}/modifier-groups/${groupId}`,
    itemProfile: (id: string | number) => `/food/vendor/items/${id}/profile`,
    kitchenOrders: '/food/vendor/kitchen/orders',
    kitchenOrderById: (id: string | number) => `/food/vendor/kitchen/orders/${id}`,
    floors: '/food/vendor/floors',
    tables: '/food/vendor/tables',
    tableById: (tableId: string | number) => `/food/vendor/tables/${tableId}`,
    openCheck: (tableId: string | number) => `/food/vendor/tables/${tableId}/open-check`,
    tableItems: (tableId: string | number) => `/food/vendor/tables/${tableId}/items`,
    settle: (tableId: string | number) => `/food/vendor/tables/${tableId}/settle`,
    cancelCheck: (tableId: string | number) => `/food/vendor/tables/${tableId}/cancel-check`,
    markCleaned: (tableId: string | number) => `/food/vendor/tables/${tableId}/mark-cleaned`,
    tableWaiter: (tableId: string | number) => `/food/vendor/tables/${tableId}/waiter`,
    tableQr: (tableId: string | number) => `/food/vendor/tables/${tableId}/qr`,
    posOrders: '/food/vendor/pos/orders',
    reservations: '/food/vendor/reservations',
    reservationById: (id: string | number) => `/food/vendor/reservations/${id}`,
    seatReservation: (id: string | number) => `/food/vendor/reservations/${id}/seat`,
    staff: '/food/vendor/staff',
    waiters: '/food/vendor/staff/waiters',
    shiftsOpen: '/food/vendor/shifts/open',
  },
} as const;
