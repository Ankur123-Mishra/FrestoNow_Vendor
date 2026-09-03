import type { ModuleType } from '@/config/constants';
import type { Order } from '@/types';

export interface VendorOrderAction {
  action: string;
  label: string;
  danger?: boolean;
}

type OrderLike = {
  status?: string;
  orderChannel?: string | null;
  orderItems?: Array<{ orderItemStatus?: string }>;
  items?: Array<{ orderItemStatus?: string }>;
};

function itemsOf(order: OrderLike) {
  return Array.isArray(order.orderItems)
    ? order.orderItems
    : Array.isArray(order.items)
      ? order.items
      : [];
}

function allItemsHaveStatus(order: OrderLike, status: string) {
  const items = itemsOf(order);
  return Boolean(items.length && items.every(item => item.orderItemStatus === status));
}

export function isPickupChannel(channel?: string | null) {
  const value = String(channel || '').toUpperCase();
  return value === 'TAKEAWAY' || value === 'SELF_PICKUP';
}

export function isDineInChannel(channel?: string | null) {
  const value = String(channel || '').toUpperCase();
  return value === 'DINE_IN' || value === 'QR_TABLE_ORDER';
}

export function isDeliveryChannel(channel?: string | null) {
  const value = String(channel || '').toUpperCase();
  return !value || value === 'ONLINE_DELIVERY' || value === 'DELIVERY';
}

export function isStorefrontModule(moduleType?: ModuleType | null): moduleType is 'FOOD' | 'GROCERY' {
  return moduleType === 'FOOD' || moduleType === 'GROCERY';
}

export function moduleSlug(moduleType?: ModuleType | null): 'food' | 'grocery' | null {
  if (moduleType === 'FOOD') {
    return 'food';
  }
  if (moduleType === 'GROCERY') {
    return 'grocery';
  }
  return null;
}

export function orderChannelLabel(channel?: string | null) {
  const key = String(channel || 'ONLINE_DELIVERY').toUpperCase();
  return (
    {
      ONLINE_DELIVERY: 'Online',
      DELIVERY: 'Online',
      TAKEAWAY: 'Takeaway',
      SELF_PICKUP: 'Pickup',
      DINE_IN: 'Dine-in',
      QR_TABLE_ORDER: 'QR table',
    }[key] ?? key.replace(/_/g, ' ')
  );
}

export function orderStatusFilters(moduleType?: ModuleType | null): Array<{ value: string; label: string }> {
  if (moduleType === 'FOOD') {
    return [
      { value: 'ALL', label: 'All' },
      { value: 'PENDING', label: 'Placed' },
      { value: 'CONFIRMED', label: 'Preparing' },
      { value: 'SHIPPED', label: 'On the way' },
      { value: 'DELIVERED', label: 'Delivered' },
      { value: 'CANCELED', label: 'Cancelled' },
    ];
  }
  if (moduleType === 'GROCERY') {
    return [
      { value: 'ALL', label: 'All' },
      { value: 'PENDING', label: 'Placed' },
      { value: 'CONFIRMED', label: 'Packing' },
      { value: 'SHIPPED', label: 'Out for delivery' },
      { value: 'DELIVERED', label: 'Delivered' },
      { value: 'CANCELED', label: 'Cancelled' },
    ];
  }
  return [
    { value: 'ALL', label: 'All' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'CONFIRMED', label: 'Confirmed' },
    { value: 'SHIPPED', label: 'Shipped' },
    { value: 'DELIVERED', label: 'Delivered' },
    { value: 'CANCELED', label: 'Canceled' },
  ];
}

export function orderStatusLabel(status?: string | null, moduleType?: ModuleType | null) {
  const key = String(status || '').toUpperCase();
  if (moduleType === 'FOOD') {
    return (
      {
        PENDING: 'Placed',
        CONFIRMED: 'Preparing',
        SHIPPED: 'On the way',
        DELIVERED: 'Delivered',
        CANCELED: 'Cancelled',
        CANCELLED: 'Cancelled',
      }[key] ?? (status || 'Unknown')
    );
  }
  if (moduleType === 'GROCERY') {
    return (
      {
        PENDING: 'Placed',
        CONFIRMED: 'Packing',
        SHIPPED: 'Out for delivery',
        DELIVERED: 'Delivered',
        CANCELED: 'Cancelled',
        CANCELLED: 'Cancelled',
      }[key] ?? (status || 'Unknown')
    );
  }
  return status || 'Unknown';
}

export function historyEntryLabel(
  status: string,
  note?: string | null,
  moduleType?: ModuleType | null,
) {
  const text = (note ?? '').toLowerCase();
  if (text.includes('packed and ready') || text.includes('food ready')) {
    return 'Ready';
  }
  if (text.includes('auto-accepted') || text.includes('inventory reserved')) {
    return orderStatusLabel('CONFIRMED', moduleType);
  }
  if (text.includes('out for delivery')) {
    return moduleType === 'FOOD' ? 'On the way' : 'Out for delivery';
  }
  if (text.includes('delivered')) {
    return 'Delivered';
  }
  if (text.includes('order placed')) {
    return 'Placed';
  }
  if (text.includes('cancel')) {
    return 'Cancelled';
  }
  if (text.includes('accept')) {
    return orderStatusLabel('CONFIRMED', moduleType);
  }
  return orderStatusLabel(status, moduleType);
}

export type KitchenBucket = 'NEW' | 'PREPARING' | 'READY' | 'PICKED';

export function kitchenBucket(order: OrderLike): KitchenBucket | 'CANCELLED' {
  const status = String(order.status || '').toUpperCase();
  if (status === 'PENDING') {
    return 'NEW';
  }
  if (status === 'CANCELED' || status === 'CANCELLED') {
    return 'CANCELLED';
  }
  if (status === 'SHIPPED' || status === 'DELIVERED') {
    return 'PICKED';
  }
  if (status === 'CONFIRMED') {
    const items = itemsOf(order);
    if (
      items.length > 0 &&
      items.every(item => String(item.orderItemStatus || '').toUpperCase() === 'DISPATCHED')
    ) {
      return 'READY';
    }
    return 'PREPARING';
  }
  return 'PICKED';
}

export function kitchenBucketLabel(bucket: KitchenBucket | 'ALL') {
  return (
    {
      ALL: 'All',
      NEW: 'New',
      PREPARING: 'Preparing',
      READY: 'Ready',
      PICKED: 'On the way',
    }[bucket] ?? bucket
  );
}

const CANCEL: VendorOrderAction = { action: 'CANCEL', label: 'Cancel', danger: true };

export function getOrderActions(moduleType: ModuleType | null | undefined, order: OrderLike): VendorOrderAction[] {
  const status = String(order.status || '').toUpperCase();

  if (moduleType === 'GROCERY') {
    if (status === 'PENDING') {
      return [CANCEL];
    }
    if (status === 'CONFIRMED' && allItemsHaveStatus(order, 'DISPATCHED')) {
      return [{ action: 'OUT_FOR_DELIVERY', label: 'Out for delivery' }, CANCEL];
    }
    if (status === 'CONFIRMED') {
      return [{ action: 'READY', label: 'Mark packed' }, CANCEL];
    }
    if (status === 'SHIPPED') {
      return [{ action: 'DELIVER', label: 'Mark delivered' }];
    }
    return [];
  }

  if (moduleType === 'FOOD') {
    if (status === 'PENDING' && allItemsHaveStatus(order, 'ORDERED')) {
      return [{ action: 'ACCEPT', label: 'Accept' }, CANCEL];
    }
    if (status === 'PENDING') {
      return [CANCEL];
    }
    if (status === 'CONFIRMED' && allItemsHaveStatus(order, 'DISPATCHED')) {
      if (isPickupChannel(order.orderChannel)) {
        return [{ action: 'COLLECT', label: 'Collected' }, CANCEL];
      }
      if (isDineInChannel(order.orderChannel)) {
        return [{ action: 'SERVED', label: 'Served' }, CANCEL];
      }
      return [{ action: 'OUT_FOR_DELIVERY', label: 'Hand to rider' }, CANCEL];
    }
    if (
      status === 'CONFIRMED' &&
      itemsOf(order).some(item => {
        const itemStatus = String(item.orderItemStatus || '').toUpperCase();
        return itemStatus === 'PROCESSING' || itemStatus === 'ORDERED';
      })
    ) {
      return [{ action: 'READY', label: 'Mark ready' }, CANCEL];
    }
    if (status === 'CONFIRMED' && allItemsHaveStatus(order, 'PROCESSING')) {
      return [{ action: 'READY', label: 'Mark ready' }, CANCEL];
    }
    if (status === 'SHIPPED' && allItemsHaveStatus(order, 'OUT_FOR_DELIVERY')) {
      return [{ action: 'DELIVER', label: 'Delivered' }];
    }
    return [];
  }

  if (status === 'PENDING') {
    return [CANCEL];
  }
  if (status === 'CONFIRMED') {
    return [{ action: 'PACK', label: 'Accept & Pack' }, CANCEL];
  }
  if (status === 'SHIPPED') {
    return [
      { action: 'OUT_FOR_DELIVERY', label: 'Out for delivery' },
      { action: 'DELIVER', label: 'Delivered' },
    ];
  }
  return [];
}

export function isFoodPendingAccept(order: OrderLike) {
  return String(order.status || '').toUpperCase() === 'PENDING';
}

export function shouldTrackDelivery(order: Order, moduleType?: ModuleType | null) {
  if (moduleType !== 'FOOD' && moduleType !== 'GROCERY') {
    return false;
  }
  const status = String(order.status || '').toUpperCase();
  if (['DELIVERED', 'CANCELLED', 'CANCELED'].includes(status)) {
    return false;
  }
  if (moduleType === 'FOOD' && !isDeliveryChannel(order.orderChannel)) {
    return false;
  }
  const items = itemsOf(order);
  const readyForPickup = items.some(item =>
    ['DISPATCHED', 'OUT_FOR_DELIVERY'].includes(String(item.orderItemStatus || '').toUpperCase()),
  );
  return readyForPickup || status === 'SHIPPED';
}

export function isDeliveryPhase(order: OrderLike) {
  const status = String(order.status || '').toUpperCase();
  if (status === 'SHIPPED') {
    return true;
  }
  if (status !== 'CONFIRMED') {
    return false;
  }
  const item = String(itemsOf(order)[0]?.orderItemStatus || '').toUpperCase();
  return ['DISPATCHED', 'OUT_FOR_DELIVERY'].includes(item);
}

export const ACCEPT_SLA_SECONDS = 5 * 60;

export function formatMmSs(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

export function acceptRemainingSeconds(createdAt?: string | null, now = Date.now()) {
  if (!createdAt) {
    return ACCEPT_SLA_SECONDS;
  }
  const start = new Date(createdAt).getTime();
  if (Number.isNaN(start)) {
    return ACCEPT_SLA_SECONDS;
  }
  return Math.max(0, Math.ceil((start + ACCEPT_SLA_SECONDS * 1000 - now) / 1000));
}
