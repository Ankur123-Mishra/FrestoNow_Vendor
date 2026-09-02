export type JsonObject = Record<string, unknown>;

export interface VendorUser {
  id?: number | string;
  name?: string;
  shopname?: string;
  email?: string;
  phone?: string;
  role?: string;
  isApproved?: boolean;
  isOnline?: boolean;
  status?: string;
  services?: string[];
  [key: string]: unknown;
}

export interface VendorDetails {
  id?: number | string;
  name?: string;
  shopname?: string;
  email?: string;
  phone?: string;
  pickup_location?: string;
  pickup_pin_code?: string;
  bank_name?: string;
  bank_account_no?: string;
  bank_ifsc?: string;
  isOnline?: boolean;
  services?: string[];
  [key: string]: unknown;
}

export interface VendorAccount {
  id?: number | string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  shopname?: string | null;
  gst_no?: string | null;
  eid_no?: string | null;
  pickup_location?: string | null;
  pickup_location_id?: number | string | null;
  pickup_pin_code?: string | null;
  bank_name?: string | null;
  bank_account_no?: string | null;
  bank_ifsc?: string | null;
  status?: string | null;
  role?: string | null;
  walletBalance?: number | string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  [key: string]: unknown;
}

export interface VendorReportRange {
  from?: string | null;
  to?: string | null;
  moduleType?: string;
}

export interface VendorReportTotals {
  orders: number;
  completed: number;
  canceled: number;
  revenue: number;
  averageOrderValue: number;
  cancelRate: number;
}

export interface VendorReportStatus {
  status: string;
  count: number;
}

export interface VendorReportChannel {
  channel: string;
  count: number;
}

export interface VendorReportDay {
  date: string;
  orders: number;
  revenue: number;
}

export interface DashboardStats {
  range: VendorReportRange;
  totals: VendorReportTotals;
  byStatus: VendorReportStatus[];
  byChannel: VendorReportChannel[];
  byDay: VendorReportDay[];
}

export interface Category {
  id: number | string;
  name: string;
  [key: string]: unknown;
}

export interface Brand {
  id: number | string;
  name: string;
  [key: string]: unknown;
}

export interface ProductOptionValue {
  id?: number | string;
  value?: string;
  name?: string;
  position?: number;
}

export interface ProductOptionInput {
  name: string;
  values: Array<string | ProductOptionValue>;
}

export interface ProductSpecInput {
  key: string;
  value: string;
}

export interface ProductAttributeInput {
  key: string;
  value: string;
}

export interface ProductVariantInput {
  sku: string;
  barcode?: string;
  stock: number;
  lowStockAt: number;
  continueSellingWhenOos: boolean;
  sellingprice: number;
  originalPrice?: number;
  costPrice?: number;
  weight?: string | number;
  weightUnit?: string;
  length?: string | number;
  breadth?: string | number;
  height?: string | number;
  dimensionUnit?: string;
  attributes: ProductAttributeInput[];
}

export interface Product {
  id: number | string;
  name: string;
  description?: string;
  categoryId?: number | string;
  category?: Category | string;
  brandId?: number | string;
  brand?: Brand | string;
  keywords?: string | string[];
  tags?: string | string[];
  meta_title?: string;
  meta_description?: string;
  meta_robots?: string;
  canonical_url?: string;
  minimum_order_quantity?: number;
  maximum_order_quantity?: number;
  productOptions?: ProductOptionInput[];
  productSpecs?: ProductSpecInput[];
  variants?: ProductVariantInput[];
  is_active?: boolean;
  thumbnail_img?: string;
  images?: string[];
  price?: number;
  sellingPrice?: number;
  [key: string]: unknown;
}

export interface ProductPayload {
  name: string;
  categoryId: string;
  brandId?: string;
  description?: string;
  keywords?: string;
  tags?: string;
  meta_title?: string;
  meta_description?: string;
  meta_robots?: string;
  canonical_url?: string;
  minimum_order_quantity?: number;
  maximum_order_quantity?: number;
  productOptions: ProductOptionInput[];
  productSpecs: ProductSpecInput[];
  variants: ProductVariantInput[];
  is_active?: boolean;
}

export interface PickedImage {
  uri: string;
  type?: string;
  fileName?: string;
}

export interface OrderCustomer {
  id?: number | string;
  name?: string;
  email?: string;
  phone?: string;
  [key: string]: unknown;
}

export interface OrderItemVariant {
  id?: number | string;
  sku?: string;
  images?: unknown[];
  attributes?: unknown[];
  product?: {
    id?: number | string;
    name?: string;
    thumbnail_img?: string;
    images?: unknown[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface OrderItem {
  id: number | string;
  name?: string;
  productName?: string;
  quantity?: number;
  price?: number | string;
  image?: string | null;
  orderItemStatus?: string;
  status?: string;
  variant?: OrderItemVariant;
  variantId?: number | string;
  vendor?: {
    id?: number | string;
    name?: string;
    shopname?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface OrderAddress {
  id?: number | string;
  fristname?: string;
  firstname?: string;
  firstName?: string;
  lastname?: string;
  lastName?: string;
  houseNo?: string;
  street?: string;
  landmark?: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
  country?: string;
  mobile?: string;
  phone?: string;
  [key: string]: unknown;
}

export interface OrderStatusHistory {
  id?: number | string;
  status?: string;
  note?: string;
  remarks?: string;
  createdAt?: string;
  created_at?: string;
  [key: string]: unknown;
}

export interface Order {
  id: number | string;
  orderNumber?: string;
  status?: string;
  orderStatus?: string;
  total?: number | string;
  totalAmount?: number | string;
  grandTotal?: number | string;
  createdAt?: string;
  created_at?: string;
  customerName?: string;
  user?: OrderCustomer;
  userId?: number | string;
  fulfillmentType?: string;
  orderChannel?: string;
  paymentMode?: string;
  paymentSource?: string;
  paymentOrderId?: string;
  notes?: string | null;
  couponCode?: string | null;
  discount?: number | string | null;
  gst?: number | string | null;
  deliveryFee?: number | string | null;
  packagingFee?: number | string | null;
  platformFee?: number | string | null;
  tipAmount?: number | string | null;
  address?: OrderAddress | null;
  statusHistories?: OrderStatusHistory[];
  items?: OrderItem[];
  orderItems?: OrderItem[];
  [key: string]: unknown;
}

export interface InventoryProduct {
  id?: number | string;
  name?: string;
  slug?: string;
  thumbnail_img?: string;
  is_active?: boolean;
  approvalStatus?: string;
  moduleType?: string;
  vendorId?: number | string;
  vendor?: {
    id?: number | string;
    shopname?: string;
    name?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface InventoryItem {
  id?: number | string;
  variantId?: number | string;
  sku?: string;
  stock?: number;
  price?: number;
  sellingPrice?: number;
  lowStockAt?: number | null;
  continueSellingWhenOos?: boolean;
  isLowStock?: boolean;
  product?: InventoryProduct;
  productId?: number | string;
  name?: string;
  productName?: string;
  [key: string]: unknown;
}

export interface InventoryPayload {
  stock: number;
  price: number;
  sellingPrice: number;
  lowStockAt: number;
  continueSellingWhenOos: boolean;
}

export interface ReturnRequest {
  id: number | string;
  status?: string;
  reason?: string;
  comments?: string;
  note?: string;
  createdAt?: string;
  [key: string]: unknown;
}

export interface Coupon {
  id: number | string;
  code?: string;
  type?: string;
  value?: number;
  minSubtotal?: number;
  maxDiscount?: number;
  startsAt?: string;
  expiresAt?: string;
  isActive?: boolean;
  moduleType?: string;
  [key: string]: unknown;
}

export interface CouponPayload {
  code: string;
  type: string;
  value: number;
  minSubtotal?: number;
  maxDiscount?: number;
  startsAt: string;
  expiresAt: string;
  isActive: boolean;
  moduleType?: string;
}

export interface WalletBalance {
  balance: number;
  adminId?: number;
  currency: string;
  raw: JsonObject;
}

export interface WalletHistoryItem {
  id?: number | string;
  amount?: number;
  type?: string;
  description?: string;
  createdAt?: string;
  created_at?: string;
  [key: string]: unknown;
}

export interface ManualShipmentPayload {
  externalOrderId?: string;
  shipmentId?: number;
  shiprocketOrderId?: number;
  awb?: string;
  labelUrl?: string;
  courierName?: string;
  rate?: number;
}

export interface ShiprocketPayload {
  length: number;
  breadth: number;
  height: number;
  weight: number;
}

export interface RegisterPayload {
  name: string;
  shopname: string;
  email: string;
  phone: string;
  password: string;
  services: string[];
  pickup_location: string;
  pickup_pin_code: string;
  bank_name: string;
  bank_account_no: string;
  bank_ifsc: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}
