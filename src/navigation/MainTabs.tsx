import React from 'react';
import { StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  Home,
  Package,
  ShoppingBag,
  UserRound,
  Wallet,
} from 'lucide-react-native';
import { DashboardScreen } from '@/screens/dashboard/DashboardScreen';
import { ProductListScreen } from '@/screens/products/ProductListScreen';
import { OrderListScreen } from '@/screens/orders/OrderListScreen';
import { WalletScreen } from '@/screens/wallet/WalletScreen';
import { MoreScreen } from '@/screens/profile/MoreScreen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/theme';
import type { MainTabParamList } from '@/types';

const Tab = createBottomTabNavigator<MainTabParamList>();

function TabIcon({
  focused,
  color,
  icon: Icon,
}: {
  focused: boolean;
  color: string;
  icon: typeof Home;
}) {
  return <Icon size={22} color={color} strokeWidth={focused ? 2.4 : 2} />;
}

function HomeIcon({ focused, color }: { focused: boolean; color: string }) {
  return <TabIcon focused={focused} color={color} icon={Home} />;
}

function ProductsIcon({ focused, color }: { focused: boolean; color: string }) {
  return <TabIcon focused={focused} color={color} icon={Package} />;
}

function OrdersIcon({ focused, color }: { focused: boolean; color: string }) {
  return <TabIcon focused={focused} color={color} icon={ShoppingBag} />;
}

function WalletIcon({ focused, color }: { focused: boolean; color: string }) {
  return <TabIcon focused={focused} color={color} icon={Wallet} />;
}

function ProfileIcon({ focused, color }: { focused: boolean; color: string }) {
  return <TabIcon focused={focused} color={color} icon={UserRound} />;
}

export function MainTabs() {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: colors.brand[700],
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarLabelStyle: styles.label,
        tabBarItemStyle: styles.tabItem,
        tabBarStyle: [
          styles.bar,
          { height: 64 + insets.bottom, paddingBottom: Math.max(insets.bottom, 8) },
        ],
      }}>
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ tabBarLabel: 'Home', tabBarIcon: HomeIcon }}
      />
      <Tab.Screen
        name="Products"
        component={ProductListScreen}
        options={{ tabBarLabel: 'Products', tabBarIcon: ProductsIcon }}
      />
      <Tab.Screen
        name="Orders"
        component={OrderListScreen}
        options={{ tabBarLabel: 'Orders', tabBarIcon: OrdersIcon }}
      />
      <Tab.Screen
        name="Wallet"
        component={WalletScreen}
        options={{ tabBarLabel: 'Wallet', tabBarIcon: WalletIcon }}
      />
      <Tab.Screen
        name="Profile"
        component={MoreScreen}
        options={{ tabBarLabel: 'Profile', tabBarIcon: ProfileIcon }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingTop: 6,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  tabItem: { paddingHorizontal: 0 },
  label: { fontSize: 11, fontWeight: '600' },
});
