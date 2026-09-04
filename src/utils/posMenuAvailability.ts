import type { Product } from '@/types';

export type PosMenuAvailability = {
  stock: number | null;
  soldOut: boolean;
  outOfStock: boolean;
  lowStock: boolean;
  unavailable: boolean;
  stockLabel: string | null;
  dietType: string | null;
};

const LOW_STOCK_AT = 5;

export function getPosMenuAvailability(product: Product): PosMenuAvailability {
  const variant = Array.isArray(product.variants) ? product.variants[0] : undefined;
  const rawStock = variant?.stock;
  const stock =
    rawStock == null || Number.isNaN(Number(rawStock))
      ? null
      : Math.max(0, Math.floor(Number(rawStock)));
  const soldOut = Boolean(product.foodProfile?.isSoldOut);
  const outOfStock = stock === 0;
  const lowStock = stock != null && stock > 0 && stock <= LOW_STOCK_AT;
  const unavailable = soldOut || outOfStock;

  let stockLabel: string | null = null;
  if (soldOut) {
    stockLabel = 'Sold out';
  } else if (outOfStock) {
    stockLabel = 'Out of stock';
  } else if (stock != null) {
    stockLabel = lowStock ? `Low · ${stock}` : `Stock ${stock}`;
  }

  const dietType = product.foodProfile?.dietType
    ? String(product.foodProfile.dietType)
    : null;

  return {
    stock,
    soldOut,
    outOfStock,
    lowStock,
    unavailable,
    stockLabel,
    dietType,
  };
}
