import type {
  Order,
  OrderAddress,
  OrderCustomer,
  OrderItem,
  OrderStatusHistory,
} from '@/types';
import { unwrapPayload } from '@/utils/apiHelpers';
import { pickNumber, pickString } from '@/utils/format';
import { resolveMediaUrl } from '@/utils/media';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function firstImagePath(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const nested = firstImagePath(entry);
      if (nested) {
        return nested;
      }
    }
  }
  const rec = asRecord(value);
  if (rec) {
    return pickString(
      rec.url,
      rec.image,
      rec.path,
      rec.src,
      rec.thumbnail,
      rec.thumbnail_img,
      rec.file,
    );
  }
  return undefined;
}

/** Detail API returns `{ success, order }`; list cards pass the order object itself. */
export function unwrapOrder(raw: unknown): Order | null {
  const payload = unwrapPayload(raw);
  const obj = asRecord(payload);
  if (!obj) {
    return null;
  }
  const nested = asRecord(obj.order);
  if (nested) {
    return nested as Order;
  }
  if (obj.orderNumber || obj.orderItems || obj.items || obj.id) {
    return obj as Order;
  }
  return null;
}

export function getOrderItems(order: Order): OrderItem[] {
  const items = order.orderItems || order.items;
  return Array.isArray(items) ? items : [];
}

export function getOrderCustomerName(order: Order): string {
  const user = order.user as OrderCustomer | undefined;
  const guest = order.guestCustomer as OrderCustomer | undefined;
  const address = asRecord(order.address);
  const addressName = address
    ? [pickString(address.fristname, address.firstname, address.firstName), pickString(address.lastname, address.lastName)]
        .filter(Boolean)
        .join(' ')
        .trim()
    : '';
  return pickString(user?.name, guest?.name, order.customerName, addressName);
}

export function getOrderCustomerPhone(order: Order): string {
  const user = order.user as OrderCustomer | undefined;
  const guest = order.guestCustomer as OrderCustomer | undefined;
  const address = asRecord(order.address);
  return pickString(user?.phone, guest?.phone, address?.mobile, address?.phone);
}

export function getOrderCustomerEmail(order: Order): string {
  const user = order.user as OrderCustomer | undefined;
  return pickString(user?.email);
}

export function getOrderTotal(order: Order): number {
  return pickNumber(order.totalAmount, order.grandTotal, order.total, order.amount);
}

export function getOrderItemName(item: OrderItem): string {
  const variant = asRecord(item.variant);
  const product = asRecord(variant?.product);
  return pickString(item.productName, item.name, product?.name, variant?.sku, `Item ${item.id}`);
}

export function getOrderItemImage(item: OrderItem): string | undefined {
  const variant = asRecord(item.variant);
  const product = asRecord(variant?.product);
  return resolveMediaUrl(
    firstImagePath(item.image) ||
      firstImagePath(variant?.images) ||
      firstImagePath(product?.thumbnail_img) ||
      firstImagePath(product?.images),
  );
}

export function getOrderItemQty(item: OrderItem): number {
  return pickNumber(item.quantity) || 1;
}

export function getOrderItemPrice(item: OrderItem): number {
  return pickNumber(item.price);
}

export function getOrderItemSku(item: OrderItem): string {
  const variant = asRecord(item.variant);
  return pickString(variant?.sku, item.sku);
}

export function getOrderItemVendor(item: OrderItem): string {
  const vendor = asRecord(item.vendor);
  return pickString(vendor?.shopname, vendor?.name);
}

export function getOrderItemVariantLabel(item: OrderItem): string {
  const variant = asRecord(item.variant);
  const metadata = asRecord(item.metadata);
  const food = asRecord(metadata?.foodCustomization);
  const attrs = Array.isArray(variant?.attributes) ? variant.attributes : [];
  const fromAttrs = attrs
    .map(attr => {
      const rec = asRecord(attr);
      if (!rec) {
        return typeof attr === 'string' ? attr : '';
      }
      const name = pickString(rec.name, rec.key, rec.attribute, rec.title);
      const value = pickString(rec.value, rec.option, rec.label);
      if (name && value) {
        return `${name}: ${value}`;
      }
      return value || name;
    })
    .filter(Boolean)
    .join(' · ');
  return pickString(fromAttrs, food?.variantName, variant?.name);
}

export function getOrderItemCustomizations(item: OrderItem): string[] {
  const metadata = asRecord(item.metadata);
  const food = asRecord(metadata?.foodCustomization);
  const list = Array.isArray(food?.customizations) ? food.customizations : [];
  return list
    .map(entry => {
      if (typeof entry === 'string') {
        return entry.trim();
      }
      const rec = asRecord(entry);
      if (!rec) {
        return '';
      }
      return pickString(rec.name, rec.label, rec.title, rec.value);
    })
    .filter(Boolean);
}

export function getOrderAddress(order: Order): OrderAddress | null {
  return asRecord(order.address) as OrderAddress | null;
}

export function getOrderAddressLines(order: Order): string[] {
  const a = getOrderAddress(order);
  if (!a) {
    return [];
  }
  const name = [
    pickString(a.fristname, a.firstname, a.firstName),
    pickString(a.lastname, a.lastName),
  ]
    .filter(Boolean)
    .join(' ')
    .trim();
  const line1 = [pickString(a.houseNo, a.house_no), pickString(a.street)].filter(Boolean).join(', ');
  const landmark = pickString(a.landmark);
  const cityLine = [pickString(a.city, a.district), pickString(a.state), pickString(a.pincode)]
    .filter(Boolean)
    .join(', ');
  const country = pickString(a.country);
  return [
    name,
    line1,
    landmark ? `Landmark: ${landmark}` : '',
    cityLine,
    country,
  ].filter(Boolean);
}

export function getOrderStatusHistories(order: Order): OrderStatusHistory[] {
  const list = order.statusHistories;
  if (!Array.isArray(list)) {
    return [];
  }
  return [...list].sort((a, b) => {
    const left = new Date(pickString(a.createdAt, a.created_at)).getTime();
    const right = new Date(pickString(b.createdAt, b.created_at)).getTime();
    if (Number.isNaN(left) || Number.isNaN(right)) {
      return 0;
    }
    return left - right;
  });
}

function hasAmount(value: unknown): boolean {
  if (value === null || value === undefined || value === '') {
    return false;
  }
  const n = Number(value);
  return !Number.isNaN(n) && n !== 0;
}

export function getOrderBillRows(order: Order): { label: string; amount: number; emphasize?: boolean }[] {
  const tax = asRecord(order.taxSnapshot);
  const items = getOrderItems(order);
  const itemSubtotal = items.reduce((sum, item) => sum + getOrderItemPrice(item) * getOrderItemQty(item), 0);
  const subtotal = hasAmount(tax?.subtotal) ? pickNumber(tax?.subtotal) : itemSubtotal;
  const rows: { label: string; amount: number; emphasize?: boolean }[] = [];

  if (hasAmount(subtotal)) {
    rows.push({ label: 'Items', amount: subtotal });
  }

  const extras: { label: string; value: unknown; negate?: boolean }[] = [
    { label: 'Discount', value: order.discount, negate: true },
    { label: 'Delivery', value: order.deliveryFee },
    { label: 'Packaging', value: order.packagingFee },
    { label: 'Platform fee', value: order.platformFee },
    { label: 'Small order fee', value: tax?.smallOrderFee },
    { label: 'Service charge', value: order.serviceCharge },
    { label: 'Tip', value: order.tipAmount },
    { label: 'GST', value: hasAmount(order.gst) ? order.gst : tax?.taxAmount },
  ];
  extras.forEach(row => {
    if (!hasAmount(row.value)) {
      return;
    }
    const amount = pickNumber(row.value);
    rows.push({ label: row.label, amount: row.negate ? -Math.abs(amount) : amount });
  });

  const total = getOrderTotal(order) || subtotal;
  if (rows.length > 0 || hasAmount(total)) {
    rows.push({ label: 'Total', amount: total, emphasize: true });
  }
  return rows;
}
