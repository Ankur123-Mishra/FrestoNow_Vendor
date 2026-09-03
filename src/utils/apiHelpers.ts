import type { DashboardStats, JsonObject, VendorAccount, WalletBalance } from '@/types';

export function unwrapPayload(body: unknown): unknown {
  if (body && typeof body === 'object' && 'data' in body) {
    const data = (body as { data: unknown }).data;
    if (data !== undefined && data !== null) {
      return data;
    }
  }
  return body;
}

export function asArray<T = JsonObject>(raw: unknown): T[] {
  if (Array.isArray(raw)) {
    return raw as T[];
  }
  if (!raw || typeof raw !== 'object') {
    return [];
  }
  const obj = raw as JsonObject;
  const nested = unwrapPayload(obj);
  if (Array.isArray(nested)) {
    return nested as T[];
  }
  const keys = [
    'items',
    'products',
    'orders',
    'categories',
    'brands',
    'history',
    'transactions',
    'ledger',
    'returns',
    'returnRequests',
    'coupons',
    'inventory',
    'services',
    'sections',
    'modifierGroups',
    'floors',
    'tables',
    'reservations',
    'staff',
    'slots',
    'templates',
    'shifts',
    'kitchenOrders',
    'menu',
  ];
  for (const key of keys) {
    const value = (nested as JsonObject)?.[key] ?? obj[key];
    if (Array.isArray(value)) {
      return value as T[];
    }
  }
  return [];
}

export function extractToken(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  const obj = payload as JsonObject;
  const nested = unwrapPayload(obj) as JsonObject | unknown;
  const candidates = [
    obj.token,
    obj.accessToken,
    obj.access_token,
    (nested as JsonObject)?.token,
    (nested as JsonObject)?.accessToken,
  ];
  for (const item of candidates) {
    if (typeof item === 'string' && item.length > 0) {
      return item;
    }
  }
  return null;
}

export function extractUser(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  const obj = payload as JsonObject;
  const nested = unwrapPayload(obj) as JsonObject;
  const user =
    obj.account ??
    obj.vendor ??
    obj.user ??
    nested?.account ??
    nested?.vendor ??
    nested?.user ??
    nested ??
    obj;
  if (user && typeof user === 'object') {
    return user as JsonObject;
  }
  return null;
}

export function extractAccount(payload: unknown): VendorAccount | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  const obj = payload as JsonObject;
  const nested = unwrapPayload(obj) as JsonObject;
  const account = obj.account ?? nested?.account ?? nested ?? obj;
  if (account && typeof account === 'object' && !Array.isArray(account)) {
    return account as VendorAccount;
  }
  return null;
}

export function getErrorMessage(error: unknown, fallback = 'Something went wrong') {
  if (!error) {
    return fallback;
  }
  if (typeof error === 'string') {
    return error;
  }
  const err = error as {
    response?: { data?: { message?: string; error?: string } };
    message?: string;
  };
  return err.response?.data?.message || err.response?.data?.error || err.message || fallback;
}

function asNumber(value: unknown) {
  const n = Number(value);
  return Number.isNaN(n) ? 0 : n;
}

export function mapDashboardStats(raw: unknown): DashboardStats {
  const source = (unwrapPayload(raw) || {}) as JsonObject;
  const totalsRaw =
    source.totals && typeof source.totals === 'object' ? (source.totals as JsonObject) : {};
  const rangeRaw =
    source.range && typeof source.range === 'object' ? (source.range as JsonObject) : {};

  return {
    range: {
      from: typeof rangeRaw.from === 'string' ? rangeRaw.from : null,
      to: typeof rangeRaw.to === 'string' ? rangeRaw.to : null,
      moduleType: typeof rangeRaw.moduleType === 'string' ? rangeRaw.moduleType : undefined,
    },
    totals: {
      orders: asNumber(totalsRaw.orders),
      completed: asNumber(totalsRaw.completed),
      canceled: asNumber(totalsRaw.canceled),
      revenue: asNumber(totalsRaw.revenue),
      averageOrderValue: asNumber(totalsRaw.averageOrderValue),
      cancelRate: asNumber(totalsRaw.cancelRate),
    },
    byStatus: asArray<JsonObject>(source.byStatus).map(item => ({
      status: String(item.status ?? ''),
      count: asNumber(item.count),
    })),
    byChannel: asArray<JsonObject>(source.byChannel).map(item => ({
      channel: String(item.channel ?? ''),
      count: asNumber(item.count),
    })),
    byDay: asArray<JsonObject>(source.byDay).map(item => ({
      date: String(item.date ?? ''),
      orders: asNumber(item.orders),
      revenue: asNumber(item.revenue),
    })),
  };
}

export function mapWalletBalance(raw: unknown): WalletBalance {
  const source = (unwrapPayload(raw) || {}) as JsonObject;
  const balance = Number(
    source.balance ?? source.availableBalance ?? source.walletBalance ?? source.amount ?? 0,
  );
  const adminId = Number(source.adminId ?? source.admin_id);
  return {
    balance: Number.isNaN(balance) ? 0 : balance,
    adminId: Number.isNaN(adminId) ? undefined : adminId,
    currency: typeof source.currency === 'string' ? source.currency : '₹',
    raw: source,
  };
}

export function mapWalletSummary(raw: unknown) {
  const source = (unwrapPayload(raw) || {}) as JsonObject;
  return {
    credit: Number(source.credit ?? source.totalCredit ?? source.credited ?? 0) || 0,
    debit: Number(source.debit ?? source.totalDebit ?? source.debited ?? 0) || 0,
    pending: Number(source.pending ?? source.pendingAmount ?? 0) || 0,
    raw: source,
  };
}

export function getEntityId(item: unknown): string | number | undefined {
  if (!item || typeof item !== 'object') {
    return undefined;
  }
  const obj = item as JsonObject;
  const id = obj.id ?? obj._id ?? obj.variantId ?? obj.productId ?? obj.orderId;
  if (typeof id === 'string' || typeof id === 'number') {
    return id;
  }
  return undefined;
}
