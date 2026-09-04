import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Users } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { AppButton } from '@/components/ui/AppButton';
import { AppEmpty } from '@/components/ui/AppEmpty';
import { AppHeader } from '@/components/ui/AppHeader';
import { AppInput } from '@/components/ui/AppInput';
import { AppLoader } from '@/components/ui/AppLoader';
import { Chip } from '@/components/ui/AppSwitchRow';
import { foodService } from '@/api/services';
import { useToastStore } from '@/store/toastStore';
import { colors, radius } from '@/theme';
import { asArray, getEntityId, getErrorMessage, unwrapPayload } from '@/utils/apiHelpers';
import { pickString, titleCaseStatus } from '@/utils/format';
import type { FoodStaff } from '@/types';

const ROLES = ['WAITER', 'CASHIER', 'MANAGER', 'KITCHEN', 'OWNER'];

export function StaffManageScreen() {
  const showToast = useToastStore(s => s.show);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [staff, setStaff] = useState<FoodStaff[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('WAITER');

  const load = useCallback(async () => {
    try {
      const res = await foodService.getStaff();
      setStaff(asArray<FoodStaff>(unwrapPayload(res.data)));
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not load staff'), 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onCreate = async () => {
    if (!name.trim() || !password.trim()) {
      showToast('Name and password are required', 'error');
      return;
    }
    setSaving(true);
    try {
      await foodService.createStaff({
        name: name.trim(),
        role,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        password: password.trim(),
      });
      showToast('Staff member added', 'success');
      setName('');
      setPhone('');
      setEmail('');
      setPassword('');
      await load();
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not create staff'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const onToggleStatus = async (item: FoodStaff) => {
    const id = getEntityId(item);
    if (!id) {
      return;
    }
    const next = String(item.status || '').toUpperCase() === 'BLOCKED' ? 'ACTIVE' : 'BLOCKED';
    try {
      await foodService.updateStaff(id, { status: next });
      showToast(`Staff marked ${next.toLowerCase()}`, 'success');
      await load();
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not update staff'), 'error');
    }
  };

  const onDelete = (item: FoodStaff) => {
    const id = getEntityId(item);
    if (!id) {
      return;
    }
    Alert.alert('Remove staff', `Remove ${pickString(item.name, 'this member')}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await foodService.deleteStaff(id);
            showToast('Staff removed', 'success');
            await load();
          } catch (error) {
            showToast(getErrorMessage(error, 'Could not remove staff'), 'error');
          }
        },
      },
    ]);
  };

  if (loading && staff.length === 0) {
    return (
      <Screen>
        <AppLoader label="Loading staff" />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader title="Staff & roles" subtitle="Create and manage restaurant team" showBack />
      <View style={styles.form}>
        <AppInput label="Name" value={name} onChangeText={setName} />
        <AppInput label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" optional />
        <AppInput label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" optional />
        <AppInput label="Temp password" value={password} onChangeText={setPassword} secureTextEntry />
        <View style={styles.chips}>
          {ROLES.map(item => (
            <Chip key={item} label={item} selected={role === item} onPress={() => setRole(item)} />
          ))}
        </View>
        <AppButton title="Add staff" onPress={onCreate} loading={saving} />
      </View>
      <FlatList
        data={staff}
        keyExtractor={(item, index) => String(getEntityId(item) ?? index)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
        ListEmptyComponent={
          <AppEmpty icon={Users} title="No staff yet" subtitle="Add waiters, cashiers or kitchen staff." />
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{pickString(item.name, 'Staff')}</Text>
              <Text style={styles.meta}>
                {titleCaseStatus(item.role) || 'Team'} · {pickString(item.phone, 'No phone')}
              </Text>
              <Text style={styles.meta}>{titleCaseStatus(String(item.status || 'ACTIVE'))}</Text>
            </View>
            <View style={styles.actions}>
              <Pressable onPress={() => onToggleStatus(item)} style={styles.actionBtn}>
                <Text style={styles.actionText}>Toggle</Text>
              </Pressable>
              <Pressable onPress={() => onDelete(item)} style={[styles.actionBtn, styles.dangerBtn]}>
                <Text style={[styles.actionText, styles.dangerText]}>Remove</Text>
              </Pressable>
            </View>
          </View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  list: { paddingBottom: 24, gap: 10, flexGrow: 1 },
  row: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  name: { fontWeight: '800', color: colors.text, fontSize: 15 },
  meta: { color: colors.muted, marginTop: 3, fontWeight: '600', fontSize: 12 },
  actions: { justifyContent: 'center', gap: 6 },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.brand[50],
  },
  dangerBtn: { backgroundColor: colors.dangerSoft },
  actionText: { color: colors.brand[800], fontWeight: '700', fontSize: 12 },
  dangerText: { color: colors.danger },
});
