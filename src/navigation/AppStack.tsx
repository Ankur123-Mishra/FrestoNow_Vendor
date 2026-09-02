import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MainTabs } from '@/navigation/MainTabs';
import { ProductFormScreen } from '@/screens/products/ProductFormScreen';
import { ProductDetailScreen } from '@/screens/products/ProductDetailScreen';
import { OrderDetailScreen } from '@/screens/orders/OrderDetailScreen';
import { VendorDetailsScreen } from '@/screens/profile/VendorDetailsScreen';
import { VendorProfileScreen } from '@/screens/profile/VendorProfileScreen';
import { ReturnListScreen } from '@/screens/returns/ReturnListScreen';
import { InventoryListScreen } from '@/screens/inventory/InventoryListScreen';
import { InventoryEditScreen } from '@/screens/inventory/InventoryEditScreen';
import { CouponListScreen } from '@/screens/coupons/CouponListScreen';
import { CouponFormScreen } from '@/screens/coupons/CouponFormScreen';
import { colors } from '@/theme';
import type { AppStackParamList } from '@/types';

const Stack = createNativeStackNavigator<AppStackParamList>();

export function AppStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        animation: 'slide_from_right',
      }}>
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="ProductForm" component={ProductFormScreen} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
      <Stack.Screen name="VendorDetails" component={VendorDetailsScreen} />
      <Stack.Screen name="VendorProfile" component={VendorProfileScreen} />
      <Stack.Screen name="Returns" component={ReturnListScreen} />
      <Stack.Screen name="Inventory" component={InventoryListScreen} />
      <Stack.Screen name="InventoryEdit" component={InventoryEditScreen} />
      <Stack.Screen name="Coupons" component={CouponListScreen} />
      <Stack.Screen name="CouponForm" component={CouponFormScreen} />
    </Stack.Navigator>
  );
}
