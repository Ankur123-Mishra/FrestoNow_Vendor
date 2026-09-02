import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '@/components/layout/Screen';
import { AppButton } from '@/components/ui/AppButton';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppInput } from '@/components/ui/AppInput';
import { VENDOR_SERVICES } from '@/config/constants';
import { useAuthStore } from '@/store/authStore';
import { useToastStore } from '@/store/toastStore';
import { colors, radius } from '@/theme';
import { isValidEmail, isValidPhone, required } from '@/utils/validators';
import type { AuthNavigation } from '@/types';

export function RegisterScreen() {
  const navigation = useNavigation<AuthNavigation>();
  const register = useAuthStore(s => s.register);
  const loading = useAuthStore(s => s.loading);
  const showToast = useToastStore(s => s.show);

  const [name, setName] = useState('');
  const [shopname, setShopname] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [pickupLocation, setPickupLocation] = useState('');
  const [pickupPin, setPickupPin] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const onSubmit = async () => {
    const next = {
      name: required(name, 'Name') || undefined,
      shopname: required(shopname, 'Shop name') || undefined,
      email: required(email, 'Email') || (!isValidEmail(email) ? 'Enter a valid email' : undefined),
      phone: required(phone, 'Phone') || (!isValidPhone(phone) ? 'Enter a 10-digit phone' : undefined),
      password:
        required(password, 'Password') ||
        (password.length < 8 ? 'Password must be at least 8 characters' : undefined),
      pickupLocation: required(pickupLocation, 'Pickup location') || undefined,
      pickupPin:
        required(pickupPin, 'Pickup PIN') ||
        (!/^\d{6}$/.test(pickupPin.trim()) ? 'Enter a 6-digit PIN code' : undefined),
      bankName: required(bankName, 'Bank name') || undefined,
      bankAccount: required(bankAccount, 'Account number') || undefined,
      bankIfsc: required(bankIfsc, 'IFSC') || undefined,
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) {
      return;
    }
    try {
      const message = await register({
        name: name.trim(),
        shopname: shopname.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
        services: [...VENDOR_SERVICES],
        pickup_location: pickupLocation.trim(),
        pickup_pin_code: pickupPin.trim(),
        bank_name: bankName.trim(),
        bank_account_no: bankAccount.trim(),
        bank_ifsc: bankIfsc.trim().toUpperCase(),
      });
      showToast(message, 'success');
      navigation.navigate('Login');
    } catch (error) {
      showToast((error as Error).message, 'error');
    }
  };

  return (
    <Screen scroll>
      <AppHeader title="Create account" subtitle="E-commerce vendor signup" showBack />
      <View style={styles.card}>
        <AppInput label="Full name" value={name} onChangeText={setName} error={errors.name} placeholder="Jane Doe" />
        <AppInput
          label="Shop name"
          value={shopname}
          onChangeText={setShopname}
          error={errors.shopname}
          placeholder="Jane E-commerce Store"
        />
        <AppInput
          label="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          error={errors.email}
          placeholder="vendor@example.com"
        />
        <AppInput
          label="Phone"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
          error={errors.phone}
          placeholder="9876543210"
          maxLength={10}
        />
        <AppInput
          label="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          error={errors.password}
          placeholder="SecurePassword123!"
        />
        <AppInput
          label="Pickup location"
          value={pickupLocation}
          onChangeText={setPickupLocation}
          error={errors.pickupLocation}
          placeholder="Main Warehouse"
        />
        <AppInput
          label="Pickup PIN code"
          keyboardType="number-pad"
          value={pickupPin}
          onChangeText={setPickupPin}
          error={errors.pickupPin}
          placeholder="110001"
          maxLength={6}
        />
        <AppInput
          label="Bank name"
          value={bankName}
          onChangeText={setBankName}
          error={errors.bankName}
          placeholder="State Bank"
        />
        <AppInput
          label="Bank account no"
          keyboardType="number-pad"
          value={bankAccount}
          onChangeText={setBankAccount}
          error={errors.bankAccount}
          placeholder="012345678912"
        />
        <AppInput
          label="Bank IFSC"
          autoCapitalize="characters"
          value={bankIfsc}
          onChangeText={setBankIfsc}
          error={errors.bankIfsc}
          placeholder="SBIN0001234"
        />
        <Text style={styles.service}>Service: ECOMMERCE</Text>
        <AppButton title="Register as vendor" onPress={onSubmit} loading={loading} />
        <Pressable onPress={() => navigation.navigate('Login')} style={styles.linkWrap}>
          <Text style={styles.link}>Already registered? Login</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  service: { color: colors.muted, marginBottom: 14, fontWeight: '600' },
  linkWrap: { marginTop: 16, alignItems: 'center' },
  link: { color: colors.brand[700], fontWeight: '700' },
});
