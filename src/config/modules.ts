import type { ModuleType } from '@/config/constants';
import { MODULE_TYPES } from '@/config/constants';
import type { VendorUser } from '@/types';

export interface ModuleMeta {
  key: ModuleType;
  label: string;
  shortLabel: string;
  description: string;
  dashboardSubtitle: string;
  shopLabel: string;
  catalogLabel: string;
  catalogTab: string;
  ordersTab: string;
  registerTitle: string;
  registerSubtitle: string;
}

export const MODULES: Record<ModuleType, ModuleMeta> = {
  ECOMMERCE: {
    key: 'ECOMMERCE',
    label: 'E-Commerce',
    shortLabel: 'E-Com',
    description: 'Sell products online with catalog, orders, coupons and Shiprocket shipping.',
    dashboardSubtitle: 'E-commerce shop overview',
    shopLabel: 'Shop name',
    catalogLabel: 'Products',
    catalogTab: 'Products',
    ordersTab: 'Orders',
    registerTitle: 'Create e-commerce account',
    registerSubtitle: 'E-commerce vendor signup',
  },
  GROCERY: {
    key: 'GROCERY',
    label: 'Grocery',
    shortLabel: 'Grocery',
    description: 'Run a grocery store with live inventory, delivery slots and same-day orders.',
    dashboardSubtitle: 'Grocery store overview',
    shopLabel: 'Store name',
    catalogLabel: 'Products',
    catalogTab: 'Products',
    ordersTab: 'Orders',
    registerTitle: 'Create grocery account',
    registerSubtitle: 'Grocery vendor signup',
  },
  FOOD: {
    key: 'FOOD',
    label: 'Food Delivery',
    shortLabel: 'Food',
    description: 'Restaurant OS: menu, kitchen, dine-in tables, POS, reservations and staff.',
    dashboardSubtitle: 'Restaurant overview',
    shopLabel: 'Restaurant name',
    catalogLabel: 'Menu',
    catalogTab: 'Menu',
    ordersTab: 'Kitchen',
    registerTitle: 'Create food account',
    registerSubtitle: 'Food delivery vendor signup',
  },
};

const MODULE_ALIASES: Record<string, ModuleType> = {
  ECOMMERCE: 'ECOMMERCE',
  E_COMMERCE: 'ECOMMERCE',
  ECOM: 'ECOMMERCE',
  GROCERY: 'GROCERY',
  FOOD: 'FOOD',
  FOOD_DELIVERY: 'FOOD',
  RESTAURANT: 'FOOD',
  ROS: 'FOOD',
};

export function normalizeModuleType(value: unknown): ModuleType | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  const key = value.trim().toUpperCase().replace(/[\s-]+/g, '_');
  return MODULE_ALIASES[key] ?? null;
}

export function extractModulesFromUser(user?: VendorUser | null): ModuleType[] {
  if (!user) {
    return [];
  }
  const found = new Set<ModuleType>();
  const push = (value: unknown) => {
    const moduleType = normalizeModuleType(value);
    if (moduleType) {
      found.add(moduleType);
    }
  };

  push(user.moduleType);
  push(user.activeModule);
  push(user.activeModuleType);

  const collections = [user.services, user.modules, user.vendorServices];
  collections.forEach(list => {
    if (Array.isArray(list)) {
      list.forEach(push);
    }
  });

  return MODULE_TYPES.filter(item => found.has(item));
}

export function extractActiveModule(
  user?: VendorUser | null,
  fallback: ModuleType = 'ECOMMERCE',
): ModuleType {
  const modules = extractModulesFromUser(user);
  const preferred =
    normalizeModuleType(user?.moduleType) ||
    normalizeModuleType(user?.activeModule) ||
    normalizeModuleType(user?.activeModuleType);
  if (preferred && (modules.length === 0 || modules.includes(preferred))) {
    return preferred;
  }
  return modules[0] || fallback;
}

export function getModuleMeta(moduleType?: ModuleType | null): ModuleMeta {
  return MODULES[moduleType || 'ECOMMERCE'];
}
