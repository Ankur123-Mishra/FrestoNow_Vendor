import {
  FOOD_ALLERGEN_OPTIONS,
  FOOD_DIET_TYPES,
  FOOD_ITEM_TYPE_OPTIONS,
  FOOD_SERVING_UNIT_OPTIONS,
  FOOD_SPICE_LEVELS,
  FOOD_TAG_OPTIONS,
} from '@/config/constants';

export type FoodIngredientForm = {
  id?: number;
  name: string;
  isIncluded: boolean;
  isRemovable: boolean;
  isActive: boolean;
};

export type FoodComboItem = {
  productId: string;
  quantity: string;
  name?: string;
};

export type FoodAttributeOption = {
  id: number | string;
  name: string;
  isActive?: boolean;
  sortOrder?: number;
};

export type FoodAttributeConfig = {
  id: number | string;
  name: string;
  isActive?: boolean;
  options?: FoodAttributeOption[];
  categories?: Array<{ categoryId: number | string }>;
};

export type FoodProfileForm = {
  dietaryType: string;
  cuisine: string;
  spiceLevel: string;
  serves: string;
  prepTimeMins: string;
  availableFrom: string;
  availableUntil: string;
  sectionId: string;
  isSoldOut: boolean;
  isAvailable: boolean;
  isPreorder: boolean;
  calories: string;
  protein: string;
  carbohydrates: string;
  fat: string;
  foodTags: string[];
  ingredients: FoodIngredientForm[];
  ingredientsDescription: string;
  allergens: string[];
  attributes: Record<string, string>;
  itemType: 'SINGLE' | 'COMBO';
  comboItems: FoodComboItem[];
};

export const emptyIngredient = (): FoodIngredientForm => ({
  name: '',
  isIncluded: true,
  isRemovable: false,
  isActive: true,
});

export const emptyFoodProfile = (): FoodProfileForm => ({
  dietaryType: 'VEG',
  cuisine: '',
  spiceLevel: 'MEDIUM',
  serves: '1',
  prepTimeMins: '20',
  availableFrom: '',
  availableUntil: '',
  sectionId: '',
  isSoldOut: false,
  isAvailable: true,
  isPreorder: false,
  calories: '',
  protein: '',
  carbohydrates: '',
  fat: '',
  foodTags: [],
  ingredients: [emptyIngredient()],
  ingredientsDescription: '',
  allergens: [],
  attributes: {},
  itemType: 'SINGLE',
  comboItems: [{ productId: '', quantity: '1' }],
});

function asStringList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map(item => String(item ?? '').trim()).filter(Boolean);
  }
  if (typeof raw === 'string') {
    return raw
      .split(/[\n,]/)
      .map(item => item.trim())
      .filter(Boolean);
  }
  return [];
}

/** Normalize API time values like "09:00:00" → "09:00" for HH:mm inputs. */
function readTimeValue(raw: unknown): string {
  const text = String(raw ?? '').trim();
  if (!text) {
    return '';
  }
  const match = text.match(/^(\d{1,2}):(\d{2})/);
  if (!match) {
    return text;
  }
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

function nutritionString(value: unknown): string {
  if (value == null || value === '') {
    return '';
  }
  return String(value);
}

function asIngredients(raw: unknown): FoodIngredientForm[] {
  if (!Array.isArray(raw) || !raw.length) {
    const names = asStringList(raw);
    if (!names.length) {
      return [emptyIngredient()];
    }
    return names.map((name, index) => ({
      id: index + 1,
      name,
      isIncluded: true,
      isRemovable: false,
      isActive: true,
    }));
  }
  const ingredients = raw.map((item, index) => {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const row = item as Record<string, unknown>;
      return {
        id: Number(row.id) > 0 ? Number(row.id) : index + 1,
        name: String(row.name ?? '').trim(),
        isIncluded: row.isIncluded !== false,
        isRemovable: Boolean(row.isRemovable),
        isActive: row.isActive !== false,
      };
    }
    return {
      id: index + 1,
      name: String(item ?? '').trim(),
      isIncluded: true,
      isRemovable: false,
      isActive: true,
    };
  });
  return ingredients.length ? ingredients : [emptyIngredient()];
}

/** Store-configured attributes for this catalog category. Unscoped attributes show on every food item. */
export function attributesForCategory(
  attributes: FoodAttributeConfig[] = [],
  categoryId?: string | number | null,
): FoodAttributeConfig[] {
  const category = Number(categoryId);
  return attributes.filter(attribute => {
    if (attribute.isActive === false) {
      return false;
    }
    const links = attribute.categories ?? [];
    if (!links.length) {
      return true;
    }
    return Number.isFinite(category) && links.some(link => Number(link.categoryId) === category);
  });
}

export function readFoodProfile(profile?: Record<string, unknown> | null): FoodProfileForm {
  if (!profile) {
    return emptyFoodProfile();
  }
  const attributes =
    profile.attributes && typeof profile.attributes === 'object' && !Array.isArray(profile.attributes)
      ? Object.fromEntries(
          Object.entries(profile.attributes as Record<string, unknown>).map(([key, value]) => [
            key,
            typeof value === 'object' && value
              ? String(
                  (value as { optionName?: string; name?: string }).optionName ??
                    (value as { name?: string }).name ??
                    '',
                )
              : String(value ?? ''),
          ]),
        )
      : {};
  const comboItems = Array.isArray(profile.comboItems)
    ? (profile.comboItems as Array<{ productId?: number; quantity?: number; name?: string }>).map(
        item => ({
          productId: item.productId != null ? String(item.productId) : '',
          quantity: String(item.quantity ?? 1),
          name: item.name,
        }),
      )
    : [];
  return {
    dietaryType: String(profile.dietType || profile.dietaryType || 'VEG'),
    cuisine: String(profile.cuisine || ''),
    spiceLevel: String(profile.spiceLevel || 'MEDIUM'),
    serves: profile.serves == null ? '1' : String(profile.serves),
    prepTimeMins: profile.prepTimeMins == null ? '20' : String(profile.prepTimeMins),
    availableFrom: readTimeValue(profile.availableFrom),
    availableUntil: readTimeValue(profile.availableUntil),
    sectionId: profile.sectionId == null ? '' : String(profile.sectionId),
    isSoldOut: Boolean(profile.isSoldOut),
    isAvailable: profile.isAvailable !== false,
    isPreorder: Boolean(profile.isPreorder),
    calories: nutritionString(profile.calories),
    protein: nutritionString(profile.protein),
    carbohydrates: nutritionString(profile.carbohydrates),
    fat: nutritionString(profile.fat),
    foodTags: asStringList(profile.foodTags),
    ingredients: asIngredients(profile.ingredients),
    ingredientsDescription: String(profile.ingredientsDescription || ''),
    allergens: asStringList(profile.allergens),
    attributes,
    itemType: profile.itemType === 'COMBO' ? 'COMBO' : 'SINGLE',
    comboItems: comboItems.length ? comboItems : [{ productId: '', quantity: '1' }],
  };
}

export function toFoodProfilePayload(profile: FoodProfileForm) {
  const ingredients = profile.ingredients
    .map((item, index) => ({
      id: item.id && item.id > 0 ? item.id : index + 1,
      name: item.name.trim(),
      isIncluded: item.isIncluded !== false,
      isRemovable: Boolean(item.isRemovable),
      sortOrder: index,
      isActive: item.isActive !== false,
    }))
    .filter(item => item.name);
  return {
    dietType: profile.dietaryType,
    isSoldOut: profile.isSoldOut,
    isAvailable: profile.isAvailable,
    isPreorder: profile.isPreorder,
    prepTimeMins: Number(profile.prepTimeMins) || undefined,
    cuisine: profile.cuisine.trim() || undefined,
    spiceLevel: profile.spiceLevel || undefined,
    serves: Number(profile.serves) || undefined,
    availableFrom: profile.availableFrom.trim() || undefined,
    availableUntil: profile.availableUntil.trim() || undefined,
    sectionId: profile.sectionId ? Number(profile.sectionId) : undefined,
    calories: profile.calories.trim() === '' ? null : Number(profile.calories),
    protein: profile.protein.trim() === '' ? null : Number(profile.protein),
    carbohydrates: profile.carbohydrates.trim() === '' ? null : Number(profile.carbohydrates),
    fat: profile.fat.trim() === '' ? null : Number(profile.fat),
    foodTags: profile.foodTags,
    ingredients,
    ingredientsDescription: profile.ingredientsDescription.trim() || undefined,
    allergens: profile.allergens,
    attributes: Object.fromEntries(
      Object.entries(profile.attributes).filter(([, value]) => String(value || '').trim()),
    ),
    itemType: profile.itemType,
    comboItems:
      profile.itemType === 'COMBO'
        ? profile.comboItems
            .filter(item => item.productId)
            .map(item => ({
              productId: Number(item.productId),
              quantity: Number(item.quantity) || 1,
              name: item.name,
            }))
        : [],
  };
}

export function validateFoodForm(
  profile: FoodProfileForm,
  variants: Array<{ variantName?: string; sellingprice: string; originalPrice?: string }>,
): string | null {
  if (!profile.dietaryType) {
    return 'Dietary type is required';
  }
  if (profile.prepTimeMins !== '' && Number(profile.prepTimeMins) < 0) {
    return 'Preparation time cannot be negative';
  }
  if (
    profile.availableFrom &&
    profile.availableUntil &&
    profile.availableFrom === profile.availableUntil
  ) {
    return 'Available from and until cannot be the same time';
  }
  for (const [field, label] of [
    ['calories', 'Calories'],
    ['protein', 'Protein'],
    ['carbohydrates', 'Carbohydrates'],
    ['fat', 'Fat'],
  ] as const) {
    const raw = profile[field].trim();
    if (raw && (!Number.isFinite(Number(raw)) || Number(raw) < 0)) {
      return `${label} must be a non-negative number`;
    }
  }
  const ingredients = profile.ingredients.map(item => item.name.trim()).filter(Boolean);
  const seen = new Set<string>();
  for (const item of ingredients) {
    const key = item.toLowerCase();
    if (seen.has(key)) {
      return 'Duplicate ingredients are not allowed';
    }
    seen.add(key);
  }
  if (!variants.length) {
    return 'Add at least one variant';
  }
  for (const [index, variant] of variants.entries()) {
    if (!variant.variantName?.trim()) {
      return `Variant ${index + 1}: variant name is required`;
    }
    if (!Number.isFinite(Number(variant.sellingprice)) || Number(variant.sellingprice) < 0) {
      return `Variant ${index + 1}: selling price cannot be negative`;
    }
    if (
      variant.originalPrice !== undefined &&
      variant.originalPrice !== '' &&
      (!Number.isFinite(Number(variant.originalPrice)) || Number(variant.originalPrice) < 0)
    ) {
      return `Variant ${index + 1}: MRP cannot be negative`;
    }
  }
  if (profile.itemType === 'COMBO') {
    const items = profile.comboItems.filter(item => item.productId);
    if (!items.length) {
      return 'Add at least one combo item';
    }
    if (items.some(item => Number(item.quantity) < 1)) {
      return 'Combo item quantity must be at least 1';
    }
  }
  return null;
}

export function modifierGroupAttachBody(group: {
  selectionType?: string | null;
  required?: boolean | null;
  minSelect?: number | null;
  maxSelect?: number | null;
  options?: Array<{ isActive?: boolean }> | null;
}) {
  const selectionType =
    String(group.selectionType || '').toUpperCase() === 'SINGLE' ? 'SINGLE' : 'MULTIPLE';
  const optionCount = (group.options ?? []).filter(option => option.isActive !== false).length;
  const parsedMax = Number(group.maxSelect);
  const maxSelect =
    selectionType === 'SINGLE'
      ? 1
      : Number.isFinite(parsedMax) && parsedMax > 1
        ? parsedMax
        : Math.max(1, optionCount);
  const required = Boolean(group.required);
  const minSelect = required
    ? Math.max(1, Number(group.minSelect) || 0)
    : Math.max(0, Number(group.minSelect) || 0);
  return {
    required,
    minSelect: Math.min(minSelect, maxSelect),
    maxSelect,
    selectionType,
  };
}

export function modifierGroupSummary(group: {
  selectionType?: string | null;
  required?: boolean | null;
  minSelect?: number | null;
  maxSelect?: number | null;
  options?: Array<{ isActive?: boolean }> | null;
}): string {
  const selectionType =
    String(group.selectionType || '').toUpperCase() === 'SINGLE' ? 'SINGLE' : 'MULTIPLE';
  const optionCount = (group.options ?? []).filter(option => option.isActive !== false).length;
  const required = Boolean(group.required) ? 'Required' : 'Optional';
  return `${required} · ${selectionType} · ${optionCount} option${optionCount === 1 ? '' : 's'}`;
}

export function toggleChip(list: string[], value: string) {
  return list.includes(value) ? list.filter(item => item !== value) : [...list, value];
}

export {
  FOOD_ALLERGEN_OPTIONS,
  FOOD_DIET_TYPES,
  FOOD_ITEM_TYPE_OPTIONS,
  FOOD_SERVING_UNIT_OPTIONS,
  FOOD_SPICE_LEVELS,
  FOOD_TAG_OPTIONS,
};
