import { create } from 'zustand';
import { STORAGE_KEYS } from '@/config/storageKeys';
import { storage } from '@/utils/storage';
import { tokenBridge } from '@/api/tokenBridge';
import { authService, vendorService } from '@/api/services';
import { extractAccount, extractUser, extractToken, getErrorMessage, asArray, unwrapPayload } from '@/utils/apiHelpers';
import { pickString } from '@/utils/format';
import { useModuleStore } from '@/store/moduleStore';
import type { LoginPayload, RegisterPayload, VendorAccount, VendorUser } from '@/types';

interface AuthState {
  token: string | null;
  user: VendorUser | null;
  hydrated: boolean;
  loading: boolean;
  hydrate: () => Promise<void>;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<string>;
  refreshProfile: () => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: VendorUser | null) => void;
}

async function persistUser(user: VendorUser) {
  await storage.setJson(STORAGE_KEYS.AUTH_USER, user);
}

function mergeVendorUser(
  current?: VendorUser | null,
  meUser?: VendorUser | null,
  account?: VendorAccount | null,
): VendorUser | null {
  if (!current && !meUser && !account) {
    return null;
  }

  const name = pickString(account?.name, meUser?.name, current?.name);
  const shopname = pickString(account?.shopname, meUser?.shopname, current?.shopname);
  const services =
    (Array.isArray(account?.services) ? account?.services : undefined) ||
    meUser?.services ||
    current?.services;

  return {
    ...(current || {}),
    ...(meUser || {}),
    id: account?.id ?? meUser?.id ?? current?.id,
    name: name || undefined,
    shopname: shopname || undefined,
    email: pickString(account?.email, meUser?.email, current?.email) || undefined,
    phone: pickString(account?.phone, meUser?.phone, current?.phone) || undefined,
    role: pickString(account?.role, meUser?.role, current?.role) || undefined,
    status: pickString(account?.status, meUser?.status, current?.status) || undefined,
    moduleType: pickString(
      meUser?.moduleType,
      meUser?.activeModule,
      account?.moduleType as string | undefined,
      current?.moduleType,
    ) || undefined,
    activeModule: pickString(meUser?.activeModule, current?.activeModule) || undefined,
    services: Array.isArray(services) ? services.map(String) : services,
    isOnline: (meUser?.isOnline ?? account?.isOnline ?? current?.isOnline) as boolean | undefined,
  };
}

async function loadAccount(): Promise<VendorAccount | null> {
  try {
    const res = await vendorService.getAccount();
    return extractAccount(res.data);
  } catch {
    return null;
  }
}

function normalizeServiceList(raw: unknown): string[] {
  return asArray(raw)
    .map(item => {
      if (typeof item === 'string') {
        return item;
      }
      if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>;
        return String(obj.moduleType ?? obj.service ?? obj.name ?? obj.type ?? '');
      }
      return String(item ?? '');
    })
    .filter(Boolean);
}

async function loadServices(): Promise<string[]> {
  try {
    const res = await vendorService.getServices();
    return normalizeServiceList(unwrapPayload(res.data));
  } catch {
    return [];
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  hydrated: false,
  loading: false,

  hydrate: async () => {
    const [token, user] = await Promise.all([
      storage.get(STORAGE_KEYS.AUTH_TOKEN),
      storage.getJson<VendorUser>(STORAGE_KEYS.AUTH_USER),
    ]);
    tokenBridge.set(token);
    tokenBridge.setUnauthorizedHandler(() => get().logout());
    await useModuleStore.getState().hydrate(user);
    set({ token, user, hydrated: true });
  },

  login: async payload => {
    set({ loading: true });
    try {
      const response = await authService.login(payload);
      const body = response.data;
      const token = extractToken(body);
      if (!token) {
        throw new Error('Login succeeded but no token was returned.');
      }
      let user = (extractUser(body) || { email: payload.email }) as VendorUser;
      tokenBridge.set(token);
      const [meResult, account, services] = await Promise.all([
        authService.getMe().catch(() => null),
        loadAccount(),
        loadServices(),
      ]);
      const meUser = meResult ? (extractUser(meResult.data) as VendorUser | null) : null;
      if (services.length) {
        user = { ...user, services };
        if (!user.moduleType) {
          user.moduleType = services[0];
        }
      }
      user = mergeVendorUser(user, meUser, account) || user;
      await storage.set(STORAGE_KEYS.AUTH_TOKEN, token);
      await persistUser(user);
      await useModuleStore.getState().syncFromUser(user);
      set({ token, user, loading: false });
    } catch (error) {
      set({ loading: false });
      throw new Error(getErrorMessage(error, 'Unable to login'));
    }
  },

  register: async payload => {
    set({ loading: true });
    try {
      const response = await authService.register(payload);
      if (payload.moduleType) {
        await storage.set(STORAGE_KEYS.ACTIVE_MODULE, payload.moduleType);
      }
      set({ loading: false });
      const message =
        (response.data as { message?: string })?.message ||
        'Registration submitted. Please wait for admin approval, then login.';
      return message;
    } catch (error) {
      set({ loading: false });
      throw new Error(getErrorMessage(error, 'Unable to register'));
    }
  },

  refreshProfile: async () => {
    try {
      const [meResult, account, services] = await Promise.all([
        authService.getMe().catch(() => null),
        loadAccount(),
        loadServices(),
      ]);
      const meUser = meResult ? (extractUser(meResult.data) as VendorUser | null) : null;
      const seeded = services.length
        ? { ...(get().user || {}), services, moduleType: get().user?.moduleType || services[0] }
        : get().user;
      const user = mergeVendorUser(seeded, meUser, account);
      if (user) {
        await persistUser(user);
        await useModuleStore.getState().syncFromUser(user);
        set({ user });
      }
    } catch {
      // Keep cached user if profile refresh fails.
    }
  },

  logout: async () => {
    tokenBridge.set(null);
    await Promise.all([
      storage.remove(STORAGE_KEYS.AUTH_TOKEN),
      storage.remove(STORAGE_KEYS.AUTH_USER),
      useModuleStore.getState().reset(),
    ]);
    set({ token: null, user: null, loading: false });
  },

  setUser: user => {
    set({ user });
    if (user) {
      persistUser(user);
    }
  },
}));
