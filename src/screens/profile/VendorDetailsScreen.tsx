import React, { useCallback, useState } from 'react';
import { StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '@/components/layout/Screen';
import { AppButton } from '@/components/ui/AppButton';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppInput } from '@/components/ui/AppInput';
import { AppLoader } from '@/components/ui/AppLoader';
import { vendorService } from '@/api/services';
import { useAuthStore } from '@/store/authStore';
import { useToastStore } from '@/store/toastStore';
import { getErrorMessage, unwrapPayload } from '@/utils/apiHelpers';
import { required } from '@/utils/validators';
import type { VendorDetails, VendorUser } from '@/types';

export function VendorDetailsScreen() {
  const user = useAuthStore(s => s.user);
  const setUser = useAuthStore(s => s.setUser);
  const showToast = useToastStore(s => s.show);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [shopname, setShopname] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const load = useCallback(async () => {
    try {
      const res = await vendorService.getMe();
      const data = (unwrapPayload(res.data) || {}) as VendorDetails;
      setName(String(data.name || user?.name || ''));
      setShopname(String(data.shopname || user?.shopname || ''));
    } catch {
      setName(String(user?.name || ''));
      setShopname(String(user?.shopname || ''));
    } finally {
      setLoading(false);
    }
  }, [user?.name, user?.shopname]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onSubmit = async () => {
    const next = {
      name: required(name, 'Name') || undefined,
      shopname: required(shopname, 'Shop name') || undefined,
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) {
      return;
    }
    setSaving(true);
    try {
      await vendorService.updateAccount({ name: name.trim(), shopname: shopname.trim() });
      setUser({ ...(user || {}), name: name.trim(), shopname: shopname.trim() } as VendorUser);
      showToast('Account updated', 'success');
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not update account'), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <AppLoader label="Loading shop details" />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <AppHeader title="Shop details" subtitle="Update name and shop name" showBack />
      <AppInput label="Owner name" value={name} onChangeText={setName} error={errors.name} />
      <AppInput label="Shop name" value={shopname} onChangeText={setShopname} error={errors.shopname} />
      <AppButton title="Save account" onPress={onSubmit} loading={saving} style={styles.btn} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  btn: { marginTop: 8, marginBottom: 16 },
});
