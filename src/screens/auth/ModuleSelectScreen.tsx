import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Check, ShoppingBag, ShoppingCart, UtensilsCrossed } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { AppButton } from '@/components/ui/AppButton';
import { AppHeader } from '@/components/ui/AppHeader';
import { MODULES } from '@/config/modules';
import { MODULE_TYPES } from '@/config/constants';
import type { ModuleType } from '@/config/constants';
import { colors, radius, shadows } from '@/theme';
import type { AuthNavigation } from '@/types';

const MODULE_ICONS: Record<ModuleType, LucideIcon> = {
  ECOMMERCE: ShoppingBag,
  GROCERY: ShoppingCart,
  FOOD: UtensilsCrossed,
};

export function ModuleSelectScreen() {
  const navigation = useNavigation<AuthNavigation>();
  const [selected, setSelected] = useState<ModuleType | null>(null);

  return (
    <Screen scroll>
      <AppHeader
        title="Choose your business"
        subtitle="Select a module to continue registration"
        showBack
      />
      <Text style={styles.hint}>
        You will register as this type of vendor. Catalog, orders and tools will match the module you pick.
      </Text>
      <View style={styles.list}>
        {MODULE_TYPES.map(key => {
          const meta = MODULES[key];
          const Icon = MODULE_ICONS[key];
          const active = selected === key;
          return (
            <Pressable
              key={key}
              onPress={() => setSelected(key)}
              style={({ pressed }) => [
                styles.card,
                active && styles.cardActive,
                pressed && styles.pressed,
              ]}>
              <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
                <Icon size={22} color={active ? colors.white : colors.brand[700]} />
              </View>
              <View style={styles.copy}>
                <Text style={styles.title}>{meta.label}</Text>
                <Text style={styles.description}>{meta.description}</Text>
              </View>
              <View style={[styles.check, active && styles.checkOn]}>
                {active ? <Check size={14} color={colors.white} strokeWidth={3} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
      <AppButton
        title="Continue"
        disabled={!selected}
        onPress={() => selected && navigation.navigate('Register', { moduleType: selected })}
      />
      <Pressable onPress={() => navigation.navigate('Login')} style={styles.linkWrap}>
        <Text style={styles.link}>Already registered? Login</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 16,
    fontWeight: '600',
  },
  list: { gap: 12, marginBottom: 20 },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    ...shadows.sm,
  },
  cardActive: {
    borderColor: colors.brand[600],
    backgroundColor: colors.brand[50],
  },
  pressed: { opacity: 0.92 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.brand[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: { backgroundColor: colors.brand[600] },
  copy: { flex: 1 },
  title: { fontWeight: '800', fontSize: 16, color: colors.text },
  description: { marginTop: 4, color: colors.muted, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  check: {
    width: 22,
    height: 22,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkOn: {
    backgroundColor: colors.brand[600],
    borderColor: colors.brand[600],
  },
  linkWrap: { marginTop: 16, alignItems: 'center' },
  link: { color: colors.brand[700], fontWeight: '700' },
});
