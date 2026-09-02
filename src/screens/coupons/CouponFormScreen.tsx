import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Screen } from '@/components/layout/Screen';
import { AppButton } from '@/components/ui/AppButton';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppInput } from '@/components/ui/AppInput';
import { AppLoader } from '@/components/ui/AppLoader';
import { AppSwitchRow, Chip } from '@/components/ui/AppSwitchRow';
import { COUPON_TYPES } from '@/config/constants';
import type { CouponType } from '@/config/constants';
import { couponService } from '@/api/services';
import { useToastStore } from '@/store/toastStore';
import { colors } from '@/theme';
import { asArray, getErrorMessage, unwrapPayload } from '@/utils/apiHelpers';
import { required } from '@/utils/validators';
import { titleCaseStatus } from '@/utils/format';
import type { AppNavigation, Coupon, CouponFormRoute } from '@/types';

function toLocalInput(iso?: string) {
  if (!iso) {
    return '';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso.slice(0, 16);
  }
  return date.toISOString().slice(0, 16);
}

function toIso(value: string) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toISOString();
}

export function CouponFormScreen() {
  const navigation = useNavigation<AppNavigation>();
  const route = useRoute<CouponFormRoute>();
  const couponId = route.params?.couponId;
  const isEdit = Boolean(couponId);
  const showToast = useToastStore(s => s.show);
  const [booting, setBooting] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [code, setCode] = useState('');
  const [type, setType] = useState<CouponType>('PERCENTAGE');
  const [value, setValue] = useState('');
  const [minSubtotal, setMinSubtotal] = useState('');
  const [maxDiscount, setMaxDiscount] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const load = useCallback(async () => {
    if (!isEdit || couponId == null) {
      return;
    }
    try {
      const res = await couponService.getAll();
      const items = asArray<Coupon>(unwrapPayload(res.data));
      const coupon = items.find(item => String(item.id) === String(couponId));
      if (coupon) {
        setCode(String(coupon.code || ''));
        setType((coupon.type as CouponType) || 'PERCENTAGE');
        setValue(String(coupon.value ?? ''));
        setMinSubtotal(String(coupon.minSubtotal ?? ''));
        setMaxDiscount(String(coupon.maxDiscount ?? ''));
        setStartsAt(toLocalInput(coupon.startsAt));
        setExpiresAt(toLocalInput(coupon.expiresAt));
        setIsActive(coupon.isActive !== false);
      }
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not load coupon'), 'error');
    } finally {
      setBooting(false);
    }
  }, [couponId, isEdit, showToast]);

  React.useEffect(() => {
    load();
  }, [load]);

  const onSubmit = async () => {
    const next = {
      code: required(code, 'Code') || undefined,
      value: required(value, 'Value') || undefined,
      startsAt: required(startsAt, 'Start date') || undefined,
      expiresAt: required(expiresAt, 'Expiry date') || undefined,
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) {
      return;
    }
    setSaving(true);
    try {
      if (isEdit && couponId != null) {
        await couponService.update(couponId, { isActive });
        showToast(isActive ? 'Coupon activated' : 'Coupon deactivated', 'success');
      } else {
        await couponService.create({
          code: code.trim().toUpperCase(),
          type,
          value: Number(value) || 0,
          minSubtotal: minSubtotal ? Number(minSubtotal) : undefined,
          maxDiscount: maxDiscount ? Number(maxDiscount) : undefined,
          startsAt: toIso(startsAt),
          expiresAt: toIso(expiresAt),
          isActive,
        });
        showToast('Coupon created', 'success');
      }
      navigation.goBack();
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not save coupon'), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (booting) {
    return (
      <Screen>
        <AppLoader label="Loading coupon" />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <AppHeader title={isEdit ? 'Toggle coupon' : 'Create coupon'} showBack />
      <AppInput
        label="Code"
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
        error={errors.code}
        placeholder="SUMMER10"
        editable={!isEdit}
      />
      <Text style={styles.label}>Type</Text>
      <View style={styles.chips}>
        {COUPON_TYPES.map(item => (
          <Chip
            key={item}
            label={titleCaseStatus(item)}
            selected={type === item}
            onPress={() => !isEdit && setType(item)}
          />
        ))}
      </View>
      <AppInput
        label="Value"
        keyboardType="decimal-pad"
        value={value}
        onChangeText={setValue}
        error={errors.value}
        placeholder="10"
        editable={!isEdit}
      />
      <AppInput
        label="Min subtotal"
        keyboardType="decimal-pad"
        value={minSubtotal}
        onChangeText={setMinSubtotal}
        optional
        editable={!isEdit}
      />
      <AppInput
        label="Max discount"
        keyboardType="decimal-pad"
        value={maxDiscount}
        onChangeText={setMaxDiscount}
        optional
        editable={!isEdit}
      />
      <AppInput
        label="Starts at (YYYY-MM-DDTHH:mm)"
        value={startsAt}
        onChangeText={setStartsAt}
        autoCapitalize="none"
        error={errors.startsAt}
        placeholder="2026-09-01T00:00"
        editable={!isEdit}
      />
      <AppInput
        label="Expires at (YYYY-MM-DDTHH:mm)"
        value={expiresAt}
        onChangeText={setExpiresAt}
        autoCapitalize="none"
        error={errors.expiresAt}
        placeholder="2026-09-30T23:59"
        editable={!isEdit}
      />
      <AppSwitchRow label="Active" value={isActive} onValueChange={setIsActive} />
      <AppButton title={isEdit ? 'Save coupon status' : 'Create coupon'} onPress={onSubmit} loading={saving} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.textSecondary, fontWeight: '600', marginBottom: 6, fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
});
