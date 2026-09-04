import type { FoodTableStatus, Product } from '@/types';
import { resolveMediaUrl } from '@/utils/media';

export const TABLE_STATUS_STYLE: Record<
  FoodTableStatus,
  { bg: string; border: string; label: string; text: string }
> = {
  FREE: { bg: '#ecfdf5', border: '#6ee7b7', label: 'Free', text: '#047857' },
  OCCUPIED: { bg: '#fff7ed', border: '#fdba74', label: 'Occupied', text: '#c2410c' },
  BILLING: { bg: '#eff6ff', border: '#93c5fd', label: 'Billing', text: '#1d4ed8' },
  RESERVED: { bg: '#f5f3ff', border: '#c4b5fd', label: 'Reserved', text: '#6d28d9' },
  CLEANING: { bg: '#f8fafc', border: '#cbd5e1', label: 'Cleaning', text: '#475569' },
};

export function tableStatusStyle(status?: string | null) {
  const key = String(status || 'FREE').toUpperCase() as FoodTableStatus;
  return TABLE_STATUS_STYLE[key] || TABLE_STATUS_STYLE.FREE;
}

export function tableCode(table: { code?: string; name?: string; id?: number | string }) {
  return String(table.code || table.name || (table.id != null ? `T${table.id}` : 'Table'));
}

export function qrImageUrl(data: string, size = 220) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
}

export function productUnitPrice(product: Product): { variantId?: number | string; price: number } | null {
  const variant = Array.isArray(product.variants) ? product.variants[0] : undefined;
  const raw = variant as Record<string, unknown> | undefined;
  const price = Number(
    raw?.sellingprice ??
      raw?.sellingPrice ??
      raw?.price ??
      product.sellingPrice ??
      product.price ??
      0,
  );
  if (!Number.isFinite(price)) {
    return null;
  }
  const variantId = raw?.id;
  return {
    price,
    variantId: typeof variantId === 'string' || typeof variantId === 'number' ? variantId : undefined,
  };
}

export function productIsSellable(product: Product) {
  return product.is_active !== false;
}

export function productImageUrl(product: Product) {
  const thumb = typeof product.thumbnail_img === 'string' ? product.thumbnail_img : undefined;
  const first = Array.isArray(product.images) ? product.images.find(item => typeof item === 'string') : undefined;
  return resolveMediaUrl(thumb || first);
}
