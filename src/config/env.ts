/**
 * Change API_BASE_URL here when switching environments.
 * Axios joins this with paths in src/api/endpoints.ts (no trailing slash).
 * IMAGE_BASE_URL is used to resolve relative media paths from the API.
 */
export const ENV = {
  APP_NAME: 'FrestoNow Vendor',
  APP_TAGLINE: 'Manage your shop, orders & payouts',
  API_BASE_URL: 'https://frestonow.com/api',
  IMAGE_BASE_URL: 'https://frestonow.com',
  REQUEST_TIMEOUT_MS: 25000,
} as const;
