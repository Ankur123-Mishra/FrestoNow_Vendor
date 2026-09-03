import React from 'react';
import { StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  ChefHat,
  Home,
  Package,
  ShoppingBag,
  UserRound,
  UtensilsCrossed,
  Wallet,
} from 'lucide-react-native';
import { DashboardScreen } from '@/screens/dashboard/DashboardScreen';
import { CatalogTabScreen } from '@/screens/catalog/CatalogTabScreen';
import { OrdersTabScreen } from '@/screens/orders/OrdersTabScreen';
import { WalletScreen } from '@/screens/wallet/WalletScreen';
import { MoreScreen } from '@/screens/profile/MoreScreen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getModuleMeta } from '@/config/modules';
import { useModuleStore } from '@/store/moduleStore';
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

function MenuIcon({ focused, color }: { focused: boolean; color: string }) {
  return <TabIcon focused={focused} color={color} icon={UtensilsCrossed} />;
}

function OrdersIcon({ focused, color }: { focused: boolean; color: string }) {
  return <TabIcon focused={focused} color={color} icon={ShoppingBag} />;
}

function KitchenIcon({ focused, color }: { focused: boolean; color: string }) {
  return <TabIcon focused={focused} color={color} icon={ChefHat} />;
}

function WalletIcon({ focused, color }: { focused: boolean; color: string }) {
  return <TabIcon focused={focused} color={color} icon={Wallet} />;
}

function ProfileIcon({ focused, color }: { focused: boolean; color: string }) {
  return <TabIcon focused={focused} color={color} icon={UserRound} />;
}

export function MainTabs() {
  const insets = useSafeAreaInsets();
  const activeModule = useModuleStore(s => s.activeModule);
  const meta = getModuleMeta(activeModule);
  const isFood = activeModule === 'FOOD';

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
        component={CatalogTabScreen}
        options={{
          tabBarLabel: meta.catalogTab,
          tabBarIcon: isFood ? MenuIcon : ProductsIcon,
        }}
      />
      <Tab.Screen
        name="Orders"
        component={OrdersTabScreen}
        options={{
          tabBarLabel: meta.ordersTab,
          tabBarIcon: isFood ? KitchenIcon : OrdersIcon,
        }}
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
