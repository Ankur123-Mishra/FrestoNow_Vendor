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
import { extractAccount, getErrorMessage } from '@/utils/apiHelpers';
import { pickString } from '@/utils/format';
import { required } from '@/utils/validators';
import { GeoLocationField } from '@/shared/location/GeoLocationField';
import type { PlaceSelection } from '@/shared/location/googleMaps';
import type { VendorUser } from '@/types';

export function VendorDetailsScreen() {
  const user = useAuthStore(s => s.user);
  const setUser = useAuthStore(s => s.setUser);
  const showToast = useToastStore(s => s.show);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [shopname, setShopname] = useState('');
  const [phone, setPhone] = useState('');
  const [gstNo, setGstNo] = useState('');
  const [eidNo, setEidNo] = useState('');
  const [pickupLocation, setPickupLocation] = useState('');
  const [pickupPin, setPickupPin] = useState('');
  const [pickupLatitude, setPickupLatitude] = useState('');
  const [pickupLongitude, setPickupLongitude] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const load = useCallback(async () => {
    try {
      const res = await vendorService.getAccount();
      const data = extractAccount(res.data) || {};
      setName(pickString(data.name, user?.name));
      setShopname(pickString(data.shopname, user?.shopname));
      setPhone(pickString(data.phone, user?.phone));
      setGstNo(pickString(data.gst_no));
      setEidNo(pickString(data.eid_no));
      setPickupLocation(pickString(data.pickup_location));
      setPickupPin(pickString(data.pickup_pin_code));
      setBankName(pickString(data.bank_name));
      setBankAccount(pickString(data.bank_account_no));
      setBankIfsc(pickString(data.bank_ifsc));
    } catch {
      setName(pickString(user?.name));
      setShopname(pickString(user?.shopname));
      setPhone(pickString(user?.phone));
    } finally {
      setLoading(false);
    }
  }, [user?.name, user?.phone, user?.shopname]);

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
      await vendorService.updateAccount({
        name: name.trim(),
        shopname: shopname.trim(),
        phone: phone.trim() || undefined,
        gst_no: gstNo.trim() || undefined,
        eid_no: eidNo.trim() || undefined,
        pickup_location: pickupLocation.trim() || undefined,
        pickup_pin_code: pickupPin.trim() || undefined,
        bank_name: bankName.trim() || undefined,
        bank_account_no: bankAccount.trim() || undefined,
        bank_ifsc: bankIfsc.trim() || undefined,
      });
      setUser({
        ...(user || {}),
        name: name.trim(),
        shopname: shopname.trim(),
        phone: phone.trim() || user?.phone,
      } as VendorUser);
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
        <AppLoader label="Loading account details" />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <AppHeader title="Edit account" subtitle="Profile, pickup and bank details" showBack />
      <AppInput label="Owner name" value={name} onChangeText={setName} error={errors.name} />
      <AppInput label="Shop name" value={shopname} onChangeText={setShopname} error={errors.shopname} />
      <AppInput label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" optional />
      <AppInput
        label="GST number"
        value={gstNo}
        onChangeText={setGstNo}
        autoCapitalize="characters"
        placeholder="22AAAAA0000A1Z5"
        optional
      />
      <AppInput label="EID number" value={eidNo} onChangeText={setEidNo} optional />
      <AppInput
        label="Pickup location"
        value={pickupLocation}
        onChangeText={setPickupLocation}
        optional
      />
      <AppInput
        label="Pickup pin code"
        value={pickupPin}
        onChangeText={setPickupPin}
        keyboardType="number-pad"
        optional
      />
      <GeoLocationField
        latitude={pickupLatitude}
        longitude={pickupLongitude}
        initialQuery={pickupLocation}
        showCoordinates={false}
        searchPlaceholder="Search pickup address or landmark"
        hint="Search, use current location, or drop a pin. Pickup address and PIN fill automatically."
        onPick={(place: PlaceSelection) => {
          setPickupLocation(place.street || place.label || pickupLocation);
          if (place.pincode) {
            setPickupPin(place.pincode);
          }
          setPickupLatitude(String(place.latitude));
          setPickupLongitude(String(place.longitude));
        }}
        onLatLngChange={(lat, lng) => {
          setPickupLatitude(lat);
          setPickupLongitude(lng);
        }}
      />
      <AppInput label="Bank name" value={bankName} onChangeText={setBankName} optional />
      <AppInput
        label="Bank account number"
        value={bankAccount}
        onChangeText={setBankAccount}
        keyboardType="number-pad"
        optional
      />
      <AppInput
        label="IFSC"
        value={bankIfsc}
        onChangeText={setBankIfsc}
        autoCapitalize="characters"
        optional
      />
      <AppButton title="Save account" onPress={onSubmit} loading={saving} style={styles.btn} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  btn: { marginTop: 8, marginBottom: 16 },
});
