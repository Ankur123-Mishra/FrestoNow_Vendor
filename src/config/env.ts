/**
 * Change API_BASE_URL here when switching environments.
 * Axios joins this with paths in src/api/endpoints.ts (no trailing slash).
 * IMAGE_BASE_URL is used to resolve relative media paths from the API.
 */
const API_BASE_URL = 'https://frestonow.com/api';
/** Socket.IO origin (API host without trailing /api). */
const SOCKET_URL = API_BASE_URL.replace(/\/api\/?$/, '') || 'https://frestonow.com';

export const ENV = {
  APP_NAME: 'FrestoNow Vendor',
  APP_TAGLINE: 'Manage your shop, orders & payouts',
  API_BASE_URL,
  SOCKET_URL,
  IMAGE_BASE_URL: 'https://frestonow.com',
  REQUEST_TIMEOUT_MS: 25000,
  GOOGLE_MAPS_API_KEY: 'AIzaSyDwGhZTBDH1iOnIe0syt5DlNLeLB6Y2N8Q',
} as const;
