/**
 * Paths are relative to ENV.API_BASE_URL (https://frestonow.com/api).
 * E-commerce vendor APIs from the current backend script.
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
    status: (id: string | number) => `/ecommerce/orders/${id}/status`,
    shipments: (id: string | number) => `/ecommerce/orders/${id}/shipments`,
    shiprocket: (id: string | number) => `/ecommerce/orders/${id}/shiprocket`,
  },
  inventory: {
    list: '/platform/inventory/vendor',
    update: (id: string | number) => `/platform/inventory/vendor/${id}`,
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
    payouts: '/finance/payouts',
  },
} as const;
