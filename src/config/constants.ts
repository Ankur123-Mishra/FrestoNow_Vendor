export const MODULE_TYPE = 'ECOMMERCE' as const;

export const ORDER_ACTIONS = ['ACCEPT', 'REJECT'] as const;

export const RETURN_ACTIONS = ['APPROVE', 'REJECT'] as const;

export const COUPON_TYPES = ['PERCENTAGE', 'FLAT'] as const;

export const POS_REFUND_SCOPES = ['FULL', 'PARTIAL'] as const;

export const VENDOR_SERVICES = ['ECOMMERCE'] as const;

export const WEIGHT_UNITS = ['g', 'kg'] as const;

export const DIMENSION_UNITS = ['cm', 'mm', 'in'] as const;

export const META_ROBOTS_OPTIONS = ['index, follow', 'noindex, follow', 'noindex, nofollow'] as const;

export type ModuleType = typeof MODULE_TYPE;
export type OrderAction = (typeof ORDER_ACTIONS)[number];
export type ReturnAction = (typeof RETURN_ACTIONS)[number];
export type CouponType = (typeof COUPON_TYPES)[number];
export type PosRefundScope = (typeof POS_REFUND_SCOPES)[number];
