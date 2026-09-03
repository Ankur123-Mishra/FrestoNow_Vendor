import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Store } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { useAuthStore } from '@/store/authStore';
import { useToastStore } from '@/store/toastStore';
import { colors, radius } from '@/theme';
import { ENV } from '@/config/env';
import { required } from '@/utils/validators';
import type { AuthNavigation } from '@/types';
import { useNavigation } from '@react-navigation/native';

export function LoginScreen() {
  const navigation = useNavigation<AuthNavigation>();
  const login = useAuthStore(s => s.login);
  const loading = useAuthStore(s => s.loading);
  const showToast = useToastStore(s => s.show);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const onSubmit = async () => {
    const next = {
      email: required(email, 'Email') || undefined,
      password: required(password, 'Password') || undefined,
    };
    setErrors(next);
    if (next.email || next.password) {
      return;
    }
    const payload = { email: email.trim(), password };
    try {
      await login(payload);
    } catch (error) {
      showToast((error as Error).message, 'error');
    }
  };

  return (
    <Screen scroll>
      <View style={styles.hero}>
        <View style={styles.logo}>
          <Store size={28} color={colors.white} />
        </View>
        <Text style={styles.brand}>{ENV.APP_NAME}</Text>
        <Text style={styles.tag}>{ENV.APP_TAGLINE}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>Welcome back</Text>
        <Text style={styles.sub}>Sign in with your vendor email.</Text>
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
          label="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          error={errors.password}
          placeholder="Your password"
        />
        <AppButton title="Login" onPress={onSubmit} loading={loading} />
        <Pressable onPress={() => navigation.navigate('ModuleSelect')} style={styles.linkWrap}>
          <Text style={styles.link}>New vendor? Create an account</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingTop: 28, paddingBottom: 24 },
  logo: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.brand[600],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  brand: { fontSize: 26, fontWeight: '800', color: colors.text },
  tag: { color: colors.muted, marginTop: 4, textAlign: 'center' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heading: { fontSize: 22, fontWeight: '800', color: colors.text },
  sub: { color: colors.muted, marginBottom: 18, marginTop: 4 },
  linkWrap: { marginTop: 16, alignItems: 'center' },
  link: { color: colors.brand[700], fontWeight: '700' },
});
