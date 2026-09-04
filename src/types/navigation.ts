import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp, RouteProp } from '@react-navigation/native';

import type { ModuleType } from '@/config/constants';

export type AuthStackParamList = {
  Login: undefined;
  ModuleSelect: undefined;
  Register: { moduleType: ModuleType };
};

export type MainTabParamList = {
  Dashboard: undefined;
  Products: undefined;
  Orders: undefined;
  Wallet: undefined;
  Profile: undefined;
};

export type AppStackParamList = {
  MainTabs: undefined;
  ProductForm: { productId?: string | number } | undefined;
  ProductDetail: { productId: string | number };
  OrderDetail: { orderId: string | number };
  VendorDetails: undefined;
  VendorProfile: undefined;
  StoreProfile: undefined;
  Returns: undefined;
  Inventory: undefined;
  InventoryEdit: { inventoryId: string | number };
  Coupons: undefined;
  CouponForm: { couponId?: string | number } | undefined;
  DeliverySlots: undefined;
  ModifierGroups: undefined;
  KitchenOrderDetail: { orderId: string | number };
  FloorsTables: undefined;
  TableCheck: { tableId: string | number; tableName?: string };
  PosOrder: undefined;
  CounterPos: undefined;
  CashShift: undefined;
  StaffManage: undefined;
  Reservations: undefined;
  StaffShifts: undefined;
  MenuSections: undefined;
  MenuAvailability: undefined;
  DeliveryTracking: undefined;
  Reports: undefined;
  Invoices: undefined;
  InvoicePreview: {
    orderId: string | number;
    format: 'html' | 'thermal';
    orderNumber?: string;
  };
  ProductReviews: undefined;
  OrderReviews: undefined;
};

export type RootStackParamList = AuthStackParamList & AppStackParamList;

export type AppNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList>,
  NativeStackNavigationProp<AppStackParamList>
>;

export type AuthNavigation = NativeStackNavigationProp<AuthStackParamList>;

export type ProductFormRoute = RouteProp<AppStackParamList, 'ProductForm'>;
export type ProductDetailRoute = RouteProp<AppStackParamList, 'ProductDetail'>;
export type OrderDetailRoute = RouteProp<AppStackParamList, 'OrderDetail'>;
export type InventoryEditRoute = RouteProp<AppStackParamList, 'InventoryEdit'>;
export type CouponFormRoute = RouteProp<AppStackParamList, 'CouponForm'>;
export type KitchenOrderDetailRoute = RouteProp<AppStackParamList, 'KitchenOrderDetail'>;
export type TableCheckRoute = RouteProp<AppStackParamList, 'TableCheck'>;
export type InvoicePreviewRoute = RouteProp<AppStackParamList, 'InvoicePreview'>;
export type RegisterRoute = RouteProp<AuthStackParamList, 'Register'>;
