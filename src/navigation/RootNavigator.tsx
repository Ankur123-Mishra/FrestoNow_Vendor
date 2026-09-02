import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar, StyleSheet, View } from 'react-native';
import { AuthStack } from '@/navigation/AuthStack';
import { AppStack } from '@/navigation/AppStack';
import { AppLoader } from '@/components/ui/AppLoader';
import { ToastHost } from '@/components/ui/ToastHost';
import { useAuthStore } from '@/store/authStore';
import { colors } from '@/theme';

export function RootNavigator() {
  const hydrated = useAuthStore(s => s.hydrated);
  const token = useAuthStore(s => s.token);
  const hydrate = useAuthStore(s => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!hydrated) {
    return (
      <View style={styles.boot}>
        <AppLoader label="Starting FrestoNow Vendor" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar barStyle="dark-content" />
      {token ? <AppStack /> : <AuthStack />}
      <ToastHost />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, backgroundColor: colors.bg },
});
