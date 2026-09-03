import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  Armchair,
  Bike,
  CalendarClock,
  Clock3,
  Layers,
  LogOut,
  Package,
  Percent,
  RotateCcw,
  Store,
  UserRound,
  Users,
  UtensilsCrossed,
} from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { AppCard } from '@/components/ui/AppCard';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppSwitchRow, Chip } from '@/components/ui/AppSwitchRow';
import { MenuRow } from '@/components/ui/MenuRow';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { vendorService } from '@/api/services';
import { MODULES } from '@/config/modules';
import { useAuthStore } from '@/store/authStore';
import { useModuleStore } from '@/store/moduleStore';
import { useToastStore } from '@/store/toastStore';
import { colors, radius, shadows } from '@/theme';
import { getErrorMessage } from '@/utils/apiHelpers';
import { pickString } from '@/utils/format';
import type { AppNavigation } from '@/types';
import type { ModuleType } from '@/config/constants';

export function MoreScreen() {
  const navigation = useNavigation<AppNavigation>();
  const user = useAuthStore(s => s.user);
  const setUser = useAuthStore(s => s.setUser);
  const logout = useAuthStore(s => s.logout);
  const activeModule = useModuleStore(s => s.activeModule);
  const availableModules = useModuleStore(s => s.availableModules);
  const setActiveModule = useModuleStore(s => s.setActiveModule);
  const showToast = useToastStore(s => s.show);
  const [onlineBusy, setOnlineBusy] = useState(false);

  const shopName = pickString(user?.shopname, user?.name, 'Vendor');
  const ownerName = pickString(user?.name, 'Vendor');
  const contact = pickString(user?.email, user?.phone, 'Signed in');
  const initial = shopName.slice(0, 1).toUpperCase();
  const isOnline = Boolean(user?.isOnline);
  const meta = MODULES[activeModule];

  const confirmLogout = () => {
    Alert.alert('Logout', 'You will need to sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const toggleOnline = async (next: boolean) => {
    setOnlineBusy(true);
    try {
      await vendorService.setOnline(next, activeModule);
      setUser({ ...(user || {}), isOnline: next });
      showToast(next ? `${meta.label} is online` : `${meta.label} is offline`, 'success');
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not update online status'), 'error');
    } finally {
      setOnlineBusy(false);
    }
  };

  const onSwitchModule = async (moduleType: ModuleType) => {
    if (moduleType === activeModule) {
      return;
    }
    await setActiveModule(moduleType);
    showToast(`Switched to ${MODULES[moduleType].label}`, 'success');
  };

  return (
    <Screen>
      <AppHeader title="Profile" subtitle={meta.label} />
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

        {activeModule !== 'ECOMMERCE' ? (
          <>
            <SectionTitle title="Store status" />
            <AppCard style={styles.card}>
              <AppSwitchRow
                label={onlineBusy ? 'Updating…' : isOnline ? `${meta.shortLabel} online` : `${meta.shortLabel} offline`}
                value={isOnline}
                onValueChange={toggleOnline}
              />
            </AppCard>
          </>
        ) : null}

        {availableModules.length > 1 ? (
          <>
            <SectionTitle title="Active module" />
            <AppCard style={styles.card}>
              <View style={styles.chips}>
                {availableModules.map(moduleType => (
                  <Chip
                    key={moduleType}
                    label={MODULES[moduleType].label}
                    selected={moduleType === activeModule}
                    onPress={() => onSwitchModule(moduleType)}
                  />
                ))}
              </View>
            </AppCard>
          </>
        ) : null}

        <SectionTitle title="Manage shop" />
        <AppCard style={styles.card}>
          <MenuRow
            icon={UserRound}
            title="Account"
            subtitle="Profile, shop and bank details"
            onPress={() => navigation.navigate('VendorProfile')}
          />
          {activeModule === 'ECOMMERCE' || activeModule === 'GROCERY' ? (
            <>
              <View style={styles.divider} />
              <MenuRow
                icon={Package}
                title="Inventory"
                subtitle={activeModule === 'GROCERY' ? 'Stock and selling price' : 'Stock and selling price'}
                onPress={() => navigation.navigate('Inventory')}
              />
              <View style={styles.divider} />
              <MenuRow
                icon={Percent}
                title="Coupons"
                subtitle="Create and toggle offers"
                onPress={() => navigation.navigate('Coupons')}
              />
            </>
          ) : null}
          {activeModule === 'ECOMMERCE' ? (
            <>
              <View style={styles.divider} />
              <MenuRow
                icon={RotateCcw}
                title="Returns"
                subtitle="Approve or reject return requests"
                onPress={() => navigation.navigate('Returns')}
              />
            </>
          ) : null}
          {activeModule === 'GROCERY' ? (
            <>
              <View style={styles.divider} />
              <MenuRow
                icon={Clock3}
                title="Delivery slots"
                subtitle="Fulfillment windows for grocery orders"
                onPress={() => navigation.navigate('DeliverySlots')}
              />
            </>
          ) : null}
          {activeModule === 'FOOD' ? (
            <>
              <View style={styles.divider} />
              <MenuRow
                icon={Layers}
                title="Menu sections"
                subtitle="Starters, mains, desserts"
                onPress={() => navigation.navigate('MenuSections')}
              />
              <View style={styles.divider} />
              <MenuRow
                icon={Layers}
                title="Modifiers"
                subtitle="Add-ons and spice options"
                onPress={() => navigation.navigate('ModifierGroups')}
              />
              <View style={styles.divider} />
              <MenuRow
                icon={Bike}
                title="Delivery tracking"
                subtitle="Rider OTP and live jobs"
                onPress={() => navigation.navigate('DeliveryTracking')}
              />
              <View style={styles.divider} />
              <MenuRow
                icon={Armchair}
                title="Tables"
                subtitle="Floors, tables and dine-in checks"
                onPress={() => navigation.navigate('FloorsTables')}
              />
              <View style={styles.divider} />
              <MenuRow
                icon={Store}
                title="POS order"
                subtitle="Direct takeaway or delivery ticket"
                onPress={() => navigation.navigate('PosOrder')}
              />
              <View style={styles.divider} />
              <MenuRow
                icon={CalendarClock}
                title="Reservations"
                subtitle="Upcoming table bookings"
                onPress={() => navigation.navigate('Reservations')}
              />
              <View style={styles.divider} />
              <MenuRow
                icon={Users}
                title="Staff & shifts"
                subtitle="Team list and cash drawer"
                onPress={() => navigation.navigate('StaffShifts')}
              />
              <View style={styles.divider} />
              <MenuRow
                icon={UtensilsCrossed}
                title="Coupons"
                subtitle="Restaurant offers"
                onPress={() => navigation.navigate('Coupons')}
              />
            </>
          ) : null}
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 6 },
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
