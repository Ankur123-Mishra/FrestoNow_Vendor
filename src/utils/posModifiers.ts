import type { FoodModifierGroup, Product } from '@/types';

export type ModifierOption = {
  id: number;
  name: string;
  price: number;
  isActive?: boolean;
};

export type ModifierGroupRule = {
  required?: boolean;
  minSelect?: number;
  maxSelect?: number;
  group: {
    id: number;
    name: string;
    options: ModifierOption[];
  };
};

export type AddonSelectionResult = {
  productId: number | string;
  variantId?: number | string;
  name: string;
  basePrice: number;
  unitPrice: number;
  quantity: number;
  modifierOptionIds: number[];
  addonLabels: string[];
};

export function productAttachedAddonIds(product: Product): number[] {
  return (product.foodProfile?.modifierGroups ?? [])
    .map(entry => Number(entry.groupId))
    .filter(id => Number.isFinite(id) && id > 0);
}

export function storeHasAddons(groups: FoodModifierGroup[] | undefined | null) {
  return (groups ?? []).some(
    group => group.isActive !== false && (group.options?.length ?? 0) > 0,
  );
}

export function productShowsAddons(
  product: Product,
  storeGroups: FoodModifierGroup[] | undefined | null,
) {
  if (productAttachedAddonIds(product).length > 0) {
    return true;
  }
  return storeHasAddons(storeGroups);
}

export function buildPosModifierGroups(
  product: Product,
  storeGroups: FoodModifierGroup[] | undefined | null,
): ModifierGroupRule[] {
  const activeGroups = (storeGroups ?? []).filter(group => group.isActive !== false);
  const attachedIds = new Set(productAttachedAddonIds(product));
  const selected =
    attachedIds.size > 0
      ? activeGroups.filter(group => attachedIds.has(Number(group.id)))
      : activeGroups;

  return selected
    .map((group): ModifierGroupRule | null => {
      const options = (group.options ?? [])
        .map((option): ModifierOption | null => {
          const id = Number(option.id);
          if (!Number.isFinite(id) || id <= 0) {
            return null;
          }
          const mapped: ModifierOption = {
            id,
            name: String(option.name || 'Add-on'),
            price: Number(option.price ?? 0) || 0,
          };
          if (option.isActive != null) {
            mapped.isActive = option.isActive;
          }
          return mapped;
        })
        .filter((option): option is ModifierOption => option != null);
      if (!options.length) {
        return null;
      }
      const groupId = Number(group.id);
      if (!Number.isFinite(groupId)) {
        return null;
      }
      return {
        required: false,
        minSelect: 0,
        maxSelect: Math.max(1, options.length),
        group: {
          id: groupId,
          name: String(group.name || 'Add-ons'),
          options,
        },
      };
    })
    .filter((rule): rule is ModifierGroupRule => rule != null);
}

export function cartLineKey(
  productId: number | string,
  variantId?: number | string,
  modifierOptionIds: number[] = [],
) {
  const opts = [...modifierOptionIds].sort((a, b) => a - b).join(',');
  return `${productId}:${variantId ?? ''}:${opts || 'none'}`;
}

export function validateAddonSelection(
  groups: ModifierGroupRule[],
  selected: number[],
): string | null {
  const selectedSet = new Set(selected);
  for (const rule of groups) {
    const optionIds = rule.group.options.map(option => option.id);
    const count = optionIds.filter(id => selectedSet.has(id)).length;
    const min = rule.required
      ? Math.max(1, rule.minSelect ?? 1)
      : Math.max(0, rule.minSelect ?? 0);
    const max = Math.max(1, rule.maxSelect ?? 1);
    if (count < min || count > max) {
      return `${rule.group.name}: pick ${min === max ? min : `${min}–${max}`}`;
    }
  }
  return null;
}
