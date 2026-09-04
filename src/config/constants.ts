export const MODULE_TYPES = ['ECOMMERCE', 'GROCERY', 'FOOD'] as const;

export type ModuleType = (typeof MODULE_TYPES)[number];

/** @deprecated Use getActiveModule() from the module store. Kept as ecommerce fallback. */
export const MODULE_TYPE: ModuleType = 'ECOMMERCE';

export const ORDER_ACTIONS = [
  'ACCEPT',
  'REJECT',
  'READY',
  'OUT_FOR_DELIVERY',
  'DELIVER',
  'COLLECT',
  'SERVED',
  'CANCEL',
  'PACK',
] as const;

export const FOOD_KITCHEN_ACTIONS = [
  'ACCEPT',
  'PREPARING',
  'READY',
  'REJECT',
  'COLLECT',
  'SERVED',
] as const;

export const FOOD_PREP_PRESETS = [15, 20, 30, 45] as const;

export const FOOD_DIET_TYPES = [
  { value: 'VEG', label: 'Vegetarian' },
  { value: 'NON_VEG', label: 'Non-vegetarian' },
  { value: 'EGG', label: 'Contains egg' },
  { value: 'VEGAN', label: 'Vegan' },
] as const;

export const FOOD_SPICE_LEVELS = ['MILD', 'MEDIUM', 'HOT'] as const;

export const FOOD_TAG_OPTIONS = [
  'Bestseller',
  'Popular',
  'New',
  'Chef Special',
  'Healthy',
  'Spicy',
  'Jain',
  'Must Try',
] as const;

export const FOOD_ALLERGEN_OPTIONS = [
  'Milk',
  'Gluten',
  'Soy',
  'Nuts',
  'Peanuts',
  'Egg',
  'Other',
] as const;

export const FOOD_ITEM_TYPE_OPTIONS = [
  { value: 'SINGLE', label: 'Single item' },
  { value: 'COMBO', label: 'Combo / meal' },
] as const;

export const FOOD_SERVING_UNIT_OPTIONS = [
  'piece',
  'plate',
  'gram',
  'kg',
  'ml',
  'litre',
  'serving',
  'L',
  'g',
  'pieces',
] as const;

/** Raw statuses the vendor sends to PUT /vendor/update-order-item-status. */
export const ORDER_ITEM_STATUSES = [
  'PROCESSING',
  'CANCELLED',
  'DISPATCHED',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
] as const;

export const RETURN_ACTIONS = ['APPROVE', 'REJECT'] as const;

export const COUPON_TYPES = ['PERCENTAGE', 'FLAT'] as const;

export const POS_REFUND_SCOPES = ['FULL', 'PARTIAL'] as const;

export const VENDOR_SERVICES = MODULE_TYPES;

export const WEIGHT_UNITS = ['g', 'kg'] as const;

export const DIMENSION_UNITS = ['cm', 'mm', 'in'] as const;

export const META_ROBOTS_OPTIONS = ['index, follow', 'noindex, follow', 'noindex, nofollow'] as const;

export const FOOD_PAYMENT_MODES = ['CASH', 'UPI', 'CARD'] as const;

export const FOOD_FULFILLMENT_TYPES = ['TAKEAWAY', 'DINE_IN', 'DELIVERY'] as const;

/** Counter POS channels (no table) — matches ROS POST /pos/orders. */
export const FOOD_POS_CHANNELS = ['TAKEAWAY', 'SELF_PICKUP'] as const;

export type OrderAction = (typeof ORDER_ACTIONS)[number];
export type FoodKitchenAction = (typeof FOOD_KITCHEN_ACTIONS)[number];
export type OrderItemStatus = (typeof ORDER_ITEM_STATUSES)[number];
export type ReturnAction = (typeof RETURN_ACTIONS)[number];
export type CouponType = (typeof COUPON_TYPES)[number];
export type PosRefundScope = (typeof POS_REFUND_SCOPES)[number];
export type FoodPaymentMode = (typeof FOOD_PAYMENT_MODES)[number];
export type FoodFulfillmentType = (typeof FOOD_FULFILLMENT_TYPES)[number];
export type FoodPosChannel = (typeof FOOD_POS_CHANNELS)[number];
