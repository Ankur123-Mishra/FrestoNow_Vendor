import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LogOut, Package, Percent, UserRound } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { AppCard } from '@/components/ui/AppCard';
import { AppHeader } from '@/components/ui/AppHeader';
import { MenuRow } from '@/components/ui/MenuRow';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { useAuthStore } from '@/store/authStore';
import { colors, radius, shadows } from '@/theme';
import { pickString } from '@/utils/format';
import type { AppNavigation } from '@/types';

export function MoreScreen() {
  const navigation = useNavigation<AppNavigation>();
  const user = useAuthStore(s => s.user);
  const logout = useAuthStore(s => s.logout);

  const shopName = pickString(user?.shopname, user?.name, 'Vendor');
  const ownerName = pickString(user?.name, 'Vendor');
  const contact = pickString(user?.email, user?.phone, 'Signed in');
  const initial = shopName.slice(0, 1).toUpperCase();

  const confirmLogout = () => {
    Alert.alert('Logout', 'You will need to sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => logout() },
    ]);
  };

  return (
    <Screen>
      <AppHeader title="Profile" subtitle="Your shop and account" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Pressable
          onPress={() => navigation.navigate('VendorProfile')}
          style={({ pressed }) => [styles.hero, pressed && styles.heroPressed]}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.shopName} numberOfLines={1}>
              {shopName}
            </Text>
            {ownerName !== shopName ? (
              <Text style={styles.ownerName} numberOfLines={1}>
                {ownerName}
              </Text>
            ) : null}
            <Text style={styles.contact} numberOfLines={1}>
              {contact}
            </Text>
          </View>
          <View style={styles.heroBadge}>
            <UserRound size={14} color={colors.brand[700]} />
            <Text style={styles.heroBadgeText}>View</Text>
          </View>
        </Pressable>

        <SectionTitle title="Manage shop" />
        <AppCard style={styles.card}>
          <MenuRow
            icon={UserRound}
            title="Account"
            subtitle="Profile, shop and bank details"
            onPress={() => navigation.navigate('VendorProfile')}
          />
          <View style={styles.divider} />
          <MenuRow
            icon={Package}
            title="Inventory"
            subtitle="Stock and selling price"
            onPress={() => navigation.navigate('Inventory')}
          />
          <View style={styles.divider} />
          <MenuRow
            icon={Percent}
            title="Coupons"
            subtitle="Create and toggle offers"
            onPress={() => navigation.navigate('Coupons')}
          />
        </AppCard>

        <Pressable
          onPress={confirmLogout}
          style={({ pressed }) => [styles.logout, pressed && styles.logoutPressed]}>
          <LogOut size={18} color={colors.danger} />
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 32 },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
    ...shadows.md,
  },
  heroPressed: { opacity: 0.92 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors.brand[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.white, fontWeight: '800', fontSize: 24 },
  heroCopy: { flex: 1 },
  shopName: { fontWeight: '800', fontSize: 20, color: colors.text },
  ownerName: { color: colors.textSecondary, fontWeight: '600', marginTop: 2 },
  contact: { color: colors.muted, marginTop: 4, fontSize: 13 },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.brand[50],
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  heroBadgeText: { color: colors.brand[700], fontWeight: '700', fontSize: 12 },
  card: { marginBottom: 16, paddingVertical: 4 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: 50,
  },
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.lg,
    paddingVertical: 14,
  },
  logoutPressed: { opacity: 0.85 },
  logoutText: { color: colors.danger, fontWeight: '800', fontSize: 15 },
});
