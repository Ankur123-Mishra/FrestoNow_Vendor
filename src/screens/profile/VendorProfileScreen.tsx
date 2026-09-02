import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Building2, Landmark, MapPin, UserRound, Wallet } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { AppBadge } from '@/components/ui/AppBadge';
import { AppCard } from '@/components/ui/AppCard';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppLoader } from '@/components/ui/AppLoader';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { vendorService } from '@/api/services';
import { useAuthStore } from '@/store/authStore';
import { useToastStore } from '@/store/toastStore';
import { colors, radius, shadows } from '@/theme';
import { extractAccount, getErrorMessage } from '@/utils/apiHelpers';
import { formatCurrency, formatDate, pickString, titleCaseStatus } from '@/utils/format';
import type { VendorAccount, VendorUser } from '@/types';

function displayValue(value?: string | number | null, fallback = 'Not added') {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  return String(value);
}

function InfoRow({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  const empty = value === 'Not added';
  return (
    <View style={[styles.infoRow, !last && styles.infoDivider]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, empty && styles.infoEmpty]}>{value}</Text>
    </View>
  );
}

export function VendorProfileScreen() {
  const user = useAuthStore(s => s.user);
  const setUser = useAuthStore(s => s.setUser);
  const showToast = useToastStore(s => s.show);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [account, setAccount] = useState<VendorAccount | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await vendorService.getAccount();
      const data = extractAccount(res.data);
      if (!data) {
        throw new Error('Account details were not returned.');
      }
      setAccount(data);
      const current = useAuthStore.getState().user;
      setUser({
        ...(current || {}),
        id: data.id ?? current?.id,
        name: pickString(data.name, current?.name),
        shopname: pickString(data.shopname, current?.shopname),
        email: pickString(data.email, current?.email),
        phone: pickString(data.phone, current?.phone),
        role: pickString(data.role, current?.role),
        status: pickString(data.status, current?.status),
      } as VendorUser);
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not load account'), 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [setUser, showToast]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (loading && !account) {
    return (
      <Screen>
        <AppLoader label="Loading account" />
      </Screen>
    );
  }

  const name = pickString(account?.name, user?.name, 'Vendor');
  const shop = pickString(account?.shopname, user?.shopname, name);
  const email = pickString(account?.email, user?.email);
  const phone = pickString(account?.phone, user?.phone);
  const status = pickString(account?.status, user?.status, 'UNKNOWN');
  const role = pickString(account?.role, user?.role, 'VENDOR');

  return (
    <Screen>
      <AppHeader title="Account" subtitle="Vendor profile and shop details" showBack />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }>
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{shop.slice(0, 1).toUpperCase()}</Text>
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroName}>{name}</Text>
              <Text style={styles.heroShop}>{shop}</Text>
              <View style={styles.badgeRow}>
                <AppBadge label={titleCaseStatus(status)} />
                <AppBadge label={titleCaseStatus(role)} tone="info" />
              </View>
            </View>
          </View>
          <View style={styles.walletChip}>
            <Wallet size={16} color={colors.brand[700]} />
            <View>
              <Text style={styles.walletLabel}>Wallet balance</Text>
              <Text style={styles.walletValue}>{formatCurrency(account?.walletBalance)}</Text>
            </View>
          </View>
        </View>

        <SectionTitle title="Personal" />
        <AppCard style={styles.card}>
          <View style={styles.sectionIcon}>
            <UserRound size={16} color={colors.brand[700]} />
            <Text style={styles.sectionHint}>Contact details</Text>
          </View>
          <InfoRow label="Name" value={displayValue(name)} />
          <InfoRow label="Email" value={displayValue(email)} />
          <InfoRow label="Phone" value={displayValue(phone)} last />
        </AppCard>

        <SectionTitle title="Shop" />
        <AppCard style={styles.card}>
          <View style={styles.sectionIcon}>
            <Building2 size={16} color={colors.brand[700]} />
            <Text style={styles.sectionHint}>Business information</Text>
          </View>
          <InfoRow label="Shop name" value={displayValue(shop)} />
          <InfoRow label="GST number" value={displayValue(account?.gst_no)} />
          <InfoRow label="EID number" value={displayValue(account?.eid_no)} last />
        </AppCard>

        <SectionTitle title="Pickup" />
        <AppCard style={styles.card}>
          <View style={styles.sectionIcon}>
            <MapPin size={16} color={colors.brand[700]} />
            <Text style={styles.sectionHint}>Pickup address</Text>
          </View>
          <InfoRow label="Location" value={displayValue(account?.pickup_location)} />
          <InfoRow label="Pin code" value={displayValue(account?.pickup_pin_code)} last />
        </AppCard>

        <SectionTitle title="Bank" />
        <AppCard style={styles.card}>
          <View style={styles.sectionIcon}>
            <Landmark size={16} color={colors.brand[700]} />
            <Text style={styles.sectionHint}>Payout account</Text>
          </View>
          <InfoRow label="Bank name" value={displayValue(account?.bank_name)} />
          <InfoRow label="Account number" value={displayValue(account?.bank_account_no)} />
          <InfoRow label="IFSC" value={displayValue(account?.bank_ifsc)} last />
        </AppCard>

        <Text style={styles.meta}>
          Joined {formatDate(account?.createdAt)}
          {account?.updatedAt ? ` · Updated ${formatDate(account?.updatedAt)}` : ''}
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 32 },
  hero: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
    gap: 16,
    ...shadows.md,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
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
  heroName: { fontWeight: '800', fontSize: 20, color: colors.text },
  heroShop: { color: colors.textSecondary, fontWeight: '600', marginTop: 2, marginBottom: 8 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  walletChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.brand[50],
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  walletLabel: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  walletValue: { color: colors.brand[800], fontSize: 18, fontWeight: '800' },
  card: { marginBottom: 4 },
  sectionIcon: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionHint: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  infoRow: { paddingVertical: 10 },
  infoDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  infoLabel: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  infoValue: { color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 3 },
  infoEmpty: { color: colors.muted, fontWeight: '600' },
  meta: {
    textAlign: 'center',
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
});
