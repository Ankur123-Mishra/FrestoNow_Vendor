import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/layout/Screen';
import { AppButton } from '@/components/ui/AppButton';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppInput } from '@/components/ui/AppInput';
import { Chip } from '@/components/ui/AppSwitchRow';
import { foodService } from '@/api/services';
import { FOOD_FULFILLMENT_TYPES } from '@/config/constants';
import type { FoodFulfillmentType } from '@/config/constants';
import { useToastStore } from '@/store/toastStore';
import { colors, radius } from '@/theme';
import { asArray, getEntityId, getErrorMessage, unwrapPayload } from '@/utils/apiHelpers';
import { pickString } from '@/utils/format';
import type { FoodMenuItem, FoodSection } from '@/types';

function flattenMenu(sections: FoodSection[]): FoodMenuItem[] {
  return sections.flatMap(section => asArray<FoodMenuItem>(section.items || section.products));
}

export function PosOrderScreen() {
  const showToast = useToastStore(s => s.show);
  const [items, setItems] = useState<FoodMenuItem[]>([]);
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [fulfillmentType, setFulfillmentType] = useState<FoodFulfillmentType>('TAKEAWAY');
  const [busy, setBusy] = useState(false);

  const loadMenu = useCallback(async () => {
    try {
      const res = await foodService.getSections();
      setItems(flattenMenu(asArray<FoodSection>(unwrapPayload(res.data))));
    } catch {
      setItems([]);
    }
  }, []);

  React.useEffect(() => {
    loadMenu();
  }, [loadMenu]);

  const onSubmit = async () => {
    if (!productId.trim()) {
      showToast('Select or enter a product', 'error');
      return;
    }
    setBusy(true);
    try {
      await foodService.createPosOrder({
        items: [{ productId: productId.trim(), quantity: Number(quantity) || 1 }],
        fulfillmentType,
      });
      showToast('POS order created', 'success');
      setProductId('');
      setQuantity('1');
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not create POS order'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <AppHeader title="POS order" subtitle="Direct takeaway or delivery ticket" showBack />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          {items.length ? (
            <View style={styles.chips}>
              {items.slice(0, 12).map(item => {
                const id = String(getEntityId(item) ?? '');
                return (
                  <Chip
                    key={id}
                    label={pickString(item.name, id)}
                    selected={productId === id}
                    onPress={() => setProductId(id)}
                  />
                );
              })}
            </View>
          ) : null}
          <AppInput label="Product ID" value={productId} onChangeText={setProductId} placeholder="45" />
          <AppInput label="Quantity" value={quantity} onChangeText={setQuantity} keyboardType="number-pad" />
          <Text style={styles.label}>Fulfillment</Text>
          <View style={styles.chips}>
            {FOOD_FULFILLMENT_TYPES.map(type => (
              <Chip
                key={type}
                label={type.replace('_', ' ')}
                selected={fulfillmentType === type}
                onPress={() => setFulfillmentType(type)}
              />
            ))}
          </View>
          <AppButton title="Create POS order" onPress={onSubmit} loading={busy} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 32 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  label: { fontWeight: '700', color: colors.textSecondary, marginBottom: 8 },
});
