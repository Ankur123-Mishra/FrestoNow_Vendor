import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp, RouteProp } from '@react-navigation/native';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
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
  Returns: undefined;
  Inventory: undefined;
  InventoryEdit: { inventoryId: string | number };
  Coupons: undefined;
  CouponForm: { couponId?: string | number } | undefined;
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
