import { create } from 'zustand';
import { STORAGE_KEYS } from '@/config/storageKeys';
import {
  extractActiveModule,
  extractModulesFromUser,
  normalizeModuleType,
} from '@/config/modules';
import { storage } from '@/utils/storage';
import type { ModuleType } from '@/config/constants';
import type { VendorUser } from '@/types';

interface ModuleState {
  activeModule: ModuleType;
  availableModules: ModuleType[];
  hydrated: boolean;
  hydrate: (user?: VendorUser | null) => Promise<void>;
  setActiveModule: (moduleType: ModuleType) => Promise<void>;
  syncFromUser: (user?: VendorUser | null) => Promise<void>;
  reset: () => Promise<void>;
}

export const useModuleStore = create<ModuleState>((set, get) => ({
  activeModule: 'ECOMMERCE',
  availableModules: ['ECOMMERCE'],
  hydrated: false,

  hydrate: async user => {
    const stored = normalizeModuleType(await storage.get(STORAGE_KEYS.ACTIVE_MODULE));
    const available = extractModulesFromUser(user);
    const fromUser = extractActiveModule(user, stored || 'ECOMMERCE');
    const activeModule =
      stored && (available.length === 0 || available.includes(stored)) ? stored : fromUser;
    const availableModules = available.length ? available : [activeModule];
    set({ activeModule, availableModules, hydrated: true });
    await storage.set(STORAGE_KEYS.ACTIVE_MODULE, activeModule);
  },

  setActiveModule: async moduleType => {
    const available = get().availableModules;
    const nextAvailable = available.includes(moduleType)
      ? available
      : [...available, moduleType];
    await storage.set(STORAGE_KEYS.ACTIVE_MODULE, moduleType);
    set({ activeModule: moduleType, availableModules: nextAvailable });
  },

  syncFromUser: async user => {
    const available = extractModulesFromUser(user);
    const stored = normalizeModuleType(await storage.get(STORAGE_KEYS.ACTIVE_MODULE));
    const fromUser = extractActiveModule(user, stored || get().activeModule);
    const activeModule =
      stored && (available.length === 0 || available.includes(stored)) ? stored : fromUser;
    const availableModules = available.length ? available : [activeModule];
    await storage.set(STORAGE_KEYS.ACTIVE_MODULE, activeModule);
    set({ activeModule, availableModules, hydrated: true });
  },

  reset: async () => {
    await storage.remove(STORAGE_KEYS.ACTIVE_MODULE);
    set({ activeModule: 'ECOMMERCE', availableModules: ['ECOMMERCE'], hydrated: true });
  },
}));

export function getActiveModule(): ModuleType {
  return useModuleStore.getState().activeModule;
}
