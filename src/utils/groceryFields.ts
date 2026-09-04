// Grocery product-level facts live on GroceryItemProfile (API: groceryProfile).
// Pack size (net quantity + unit) stays on variant attributes only.

export interface GroceryDetails {
  brand: string;
  foodType: string;
  countryOfOrigin: string;
  fssai: string;
  shelfLife: string;
  storage: string;
  marketedBy: string;
  nutritionInfo: string;
  allergens: string;
  isColdChain: boolean;
}

export interface GroceryProfilePayload {
  foodType: string;
  countryOfOrigin: string;
  fssai: string;
  shelfLife: string;
  storage: string;
  marketedBy: string;
  nutritionInfo: string;
  allergens: string;
  isColdChain: boolean;
}

export const emptyGroceryDetails = (): GroceryDetails => ({
  brand: '',
  foodType: '',
  countryOfOrigin: '',
  fssai: '',
  shelfLife: '',
  storage: '',
  marketedBy: '',
  nutritionInfo: '',
  allergens: '',
  isColdChain: false,
});

export const FOOD_TYPE_OPTIONS = ['Veg', 'Non-veg', 'Not Applicable'] as const;
export const UNIT_OPTIONS = ['g', 'kg', 'ml', 'L', 'piece', 'pack', 'dozen', 'combo'] as const;

export function toGroceryProfilePayload(details: GroceryDetails): GroceryProfilePayload {
  return {
    foodType: details.foodType.trim(),
    countryOfOrigin: details.countryOfOrigin.trim(),
    fssai: details.fssai.trim(),
    shelfLife: details.shelfLife.trim(),
    storage: details.storage.trim(),
    marketedBy: details.marketedBy.trim(),
    nutritionInfo: details.nutritionInfo.trim(),
    allergens: details.allergens.trim(),
    isColdChain: Boolean(details.isColdChain),
  };
}

export function fromGroceryProfile(raw?: Record<string, unknown> | null): GroceryDetails {
  if (!raw || typeof raw !== 'object') {
    return emptyGroceryDetails();
  }
  return {
    brand: String(raw.brand ?? ''),
    foodType: String(raw.foodType ?? ''),
    countryOfOrigin: String(raw.countryOfOrigin ?? ''),
    fssai: String(raw.fssai ?? ''),
    shelfLife: String(raw.shelfLife ?? ''),
    storage: String(raw.storage ?? ''),
    marketedBy: String(raw.marketedBy ?? ''),
    nutritionInfo: String(raw.nutritionInfo ?? ''),
    allergens: String(raw.allergens ?? ''),
    isColdChain: Boolean(raw.isColdChain),
  };
}
