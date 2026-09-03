import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { Screen } from '@/components/layout/Screen';
import { AppButton } from '@/components/ui/AppButton';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppInput } from '@/components/ui/AppInput';
import { Chip } from '@/components/ui/AppSwitchRow';
import { foodService } from '@/api/services';
import { FOOD_PAYMENT_MODES } from '@/config/constants';
import type { FoodPaymentMode } from '@/config/constants';
import { useToastStore } from '@/store/toastStore';
import { colors, radius } from '@/theme';
import { asArray, getEntityId, getErrorMessage, unwrapPayload } from '@/utils/apiHelpers';
import { pickString } from '@/utils/format';
import type { FoodMenuItem, FoodSection, TableCheckRoute } from '@/types';

function flattenMenu(sections: FoodSection[]): FoodMenuItem[] {
  return sections.flatMap(section => asArray<FoodMenuItem>(section.items || section.products));
}

export function TableCheckScreen() {
  const route = useRoute<TableCheckRoute>();
  const showToast = useToastStore(s => s.show);
  const [covers, setCovers] = useState('2');
  const [waiterId, setWaiterId] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [paymentMode, setPaymentMode] = useState<FoodPaymentMode>('CASH');
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<FoodMenuItem[]>([]);

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

  const selectedItem = useMemo(
    () => items.find(item => String(getEntityId(item)) === productId),
    [items, productId],
  );

  const run = async (work: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await work();
      showToast(success, 'success');
    } catch (error) {
      showToast(getErrorMessage(error, 'Action failed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <AppHeader
        title={route.params.tableName || `Table ${route.params.tableId}`}
        subtitle="Open check, add items, settle"
        showBack
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <Text style={styles.heading}>Open check</Text>
          <AppInput label="Covers" value={covers} onChangeText={setCovers} keyboardType="number-pad" />
          <AppInput label="Waiter ID" value={waiterId} onChangeText={setWaiterId} placeholder="3" optional />
          <AppButton
            title="Open check"
            loading={busy}
            onPress={() =>
              run(
                () =>
                  foodService.openCheck(route.params.tableId, {
                    covers: Number(covers) || 1,
                    ...(waiterId.trim() ? { waiterId: waiterId.trim() } : {}),
                  }),
                'Check opened',
              )
            }
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.heading}>Add items</Text>
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
          <AppInput
            label="Product ID"
            value={productId}
            onChangeText={setProductId}
            placeholder={selectedItem ? String(selectedItem.id) : '55'}
          />
          <AppInput label="Quantity" value={quantity} onChangeText={setQuantity} keyboardType="number-pad" />
          <AppButton
            title="Add to check"
            loading={busy}
            onPress={() =>
              run(
                () =>
                  foodService.addTableItems(route.params.tableId, [
                    { productId, quantity: Number(quantity) || 1 },
                  ]),
                'Items added',
              )
            }
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.heading}>Settle bill</Text>
          <View style={styles.chips}>
            {FOOD_PAYMENT_MODES.map(mode => (
              <Chip key={mode} label={mode} selected={paymentMode === mode} onPress={() => setPaymentMode(mode)} />
            ))}
          </View>
          <AppButton
            title="Settle check"
            loading={busy}
            onPress={() =>
              run(
                () => foodService.settleCheck(route.params.tableId, { paymentMode }),
                'Check settled',
              )
            }
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 32, gap: 12 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heading: { fontWeight: '800', fontSize: 16, color: colors.text, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
});
