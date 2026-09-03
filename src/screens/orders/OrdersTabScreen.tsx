import React from 'react';
import { useModuleStore } from '@/store/moduleStore';
import { KitchenOrdersScreen } from '@/screens/food/KitchenOrdersScreen';
import { OrderListScreen } from '@/screens/orders/OrderListScreen';

export function OrdersTabScreen() {
  const activeModule = useModuleStore(s => s.activeModule);
  if (activeModule === 'FOOD') {
    return <KitchenOrdersScreen />;
  }
  return <OrderListScreen />;
}
