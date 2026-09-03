import {
  FOOD_DIET_TYPES,
  FOOD_SPICE_LEVELS,
  FOOD_TAG_OPTIONS,
} from '@/config/constants';

export type FoodProfileForm = {
  dietaryType: string;
  cuisine: string;
  spiceLevel: string;
  serves: string;
  prepTimeMins: string;
  sectionId: string;
  isSoldOut: boolean;
  isAvailable: boolean;
  foodTags: string[];
  ingredientsDescription: string;
  allergens: string;
};

export const emptyFoodProfile = (): FoodProfileForm => ({
  dietaryType: 'VEG',
  cuisine: '',
  spiceLevel: 'MEDIUM',
  serves: '1',
  prepTimeMins: '20',
  sectionId: '',
  isSoldOut: false,
  isAvailable: true,
  foodTags: [],
  ingredientsDescription: '',
  allergens: '',
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

export function readFoodProfile(profile?: Record<string, unknown> | null): FoodProfileForm {
  if (!profile) {
    return emptyFoodProfile();
  }
  return {
    dietaryType: String(profile.dietType || profile.dietaryType || 'VEG'),
    cuisine: String(profile.cuisine || ''),
    spiceLevel: String(profile.spiceLevel || 'MEDIUM'),
    serves: profile.serves == null ? '1' : String(profile.serves),
    prepTimeMins: profile.prepTimeMins == null ? '20' : String(profile.prepTimeMins),
    sectionId: profile.sectionId == null ? '' : String(profile.sectionId),
    isSoldOut: Boolean(profile.isSoldOut),
    isAvailable: profile.isAvailable !== false,
    foodTags: asStringList(profile.foodTags),
    ingredientsDescription: String(profile.ingredientsDescription || ''),
    allergens: asStringList(profile.allergens).join(', '),
  };
}

export function toFoodProfilePayload(profile: FoodProfileForm) {
  return {
    dietType: profile.dietaryType,
    isSoldOut: profile.isSoldOut,
    isAvailable: profile.isAvailable,
    prepTimeMins: Number(profile.prepTimeMins) || undefined,
    cuisine: profile.cuisine.trim() || undefined,
    spiceLevel: profile.spiceLevel || undefined,
    serves: Number(profile.serves) || undefined,
    sectionId: profile.sectionId ? Number(profile.sectionId) : undefined,
    foodTags: profile.foodTags,
    ingredientsDescription: profile.ingredientsDescription.trim() || undefined,
    allergens: asStringList(profile.allergens),
  };
}

export function toggleChip(list: string[], value: string) {
  return list.includes(value) ? list.filter(item => item !== value) : [...list, value];
}

export { FOOD_DIET_TYPES, FOOD_SPICE_LEVELS, FOOD_TAG_OPTIONS };
