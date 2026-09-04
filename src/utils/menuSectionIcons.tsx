import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import {
  Apple,
  Beef,
  CakeSlice,
  Cherry,
  Coffee,
  Cookie,
  CookingPot,
  Croissant,
  CupSoda,
  Drumstick,
  EggFried,
  Fish,
  Flame,
  Hamburger,
  IceCreamCone,
  Leaf,
  Pizza,
  Popcorn,
  Salad,
  Sandwich,
  Soup,
  Sparkles,
  UtensilsCrossed,
  Wheat,
  Wine,
} from 'lucide-react-native';
import type { PickedImage } from '@/types';
import { colors, radius } from '@/theme';
import { resolveMediaUrl } from '@/utils/media';

export const MENU_SECTION_ICONS: Array<{
  key: string;
  label: string;
  Icon: LucideIcon;
}> = [
  { key: 'utensils', label: 'Meals', Icon: UtensilsCrossed },
  { key: 'soup', label: 'Starters / soup', Icon: Soup },
  { key: 'salad', label: 'Salads', Icon: Salad },
  { key: 'pizza', label: 'Pizza', Icon: Pizza },
  { key: 'hamburger', label: 'Burgers', Icon: Hamburger },
  { key: 'sandwich', label: 'Sandwiches', Icon: Sandwich },
  { key: 'beef', label: 'Mains', Icon: Beef },
  { key: 'fish', label: 'Seafood', Icon: Fish },
  { key: 'drumstick', label: 'Chicken', Icon: Drumstick },
  { key: 'cooking-pot', label: 'Curries', Icon: CookingPot },
  { key: 'wheat', label: 'Breads', Icon: Wheat },
  { key: 'croissant', label: 'Bakery', Icon: Croissant },
  { key: 'ice-cream', label: 'Ice cream', Icon: IceCreamCone },
  { key: 'cake', label: 'Desserts', Icon: CakeSlice },
  { key: 'coffee', label: 'Coffee', Icon: Coffee },
  { key: 'cup-soda', label: 'Drinks', Icon: CupSoda },
  { key: 'wine', label: 'Beverages', Icon: Wine },
  { key: 'popcorn', label: 'Snacks', Icon: Popcorn },
  { key: 'cookie', label: 'Sweets', Icon: Cookie },
  { key: 'flame', label: 'Chef special', Icon: Flame },
  { key: 'leaf', label: 'Veg', Icon: Leaf },
  { key: 'sparkles', label: 'Signature', Icon: Sparkles },
  { key: 'egg-fried', label: 'Breakfast', Icon: EggFried },
  { key: 'apple', label: 'Healthy', Icon: Apple },
  { key: 'cherry', label: 'Fruit', Icon: Cherry },
];

const BY_KEY: Record<string, LucideIcon> = Object.fromEntries(
  MENU_SECTION_ICONS.map(item => [item.key, item.Icon]),
);

export function MenuSectionIcon({
  name,
  iconUrl,
  size = 18,
  color = colors.brand[700],
}: {
  name?: string | null;
  iconUrl?: string | null;
  size?: number;
  color?: string;
}) {
  const resolved = resolveMediaUrl(iconUrl);
  if (resolved) {
    return <Image source={{ uri: resolved }} style={{ width: size, height: size, borderRadius: size }} />;
  }
  const Icon = (name && BY_KEY[name]) || UtensilsCrossed;
  return <Icon size={size} color={color} />;
}

export function MenuSectionIconPicker({
  value,
  iconUrl,
  onChange,
  onCustomFile,
  onClearCustom,
}: {
  value?: string | null;
  iconUrl?: string | null;
  onChange: (key: string | null) => void;
  onCustomFile?: () => void;
  onClearCustom?: () => void;
}) {
  const preview = resolveMediaUrl(iconUrl);
  return (
    <View style={styles.wrap}>
      {onCustomFile ? (
        <View style={styles.customRow}>
          {preview ? <Image source={{ uri: preview }} style={styles.customPreview} /> : null}
          <Pressable onPress={onCustomFile} style={styles.customBtn}>
            <Text style={styles.customBtnText}>{preview ? 'Replace image' : 'Upload icon'}</Text>
          </Pressable>
          {preview && onClearCustom ? (
            <Pressable onPress={onClearCustom} style={styles.clearBtn}>
              <Text style={styles.clearText}>Remove</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <View style={styles.grid}>
        <Pressable
          onPress={() => onChange(null)}
          style={[styles.iconBtn, !value && !preview && styles.iconBtnOn]}
        >
          <Text style={styles.noneMark}>—</Text>
        </Pressable>
        {MENU_SECTION_ICONS.map(({ key, label, Icon }) => {
          const selected = !preview && value === key;
          return (
            <Pressable
              key={key}
              onPress={() => onChange(key)}
              accessibilityLabel={label}
              style={[styles.iconBtn, selected && styles.iconBtnOn]}
            >
              <Icon size={16} color={selected ? colors.brand[800] : colors.textSecondary} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function buildMenuSectionBody(fields: {
  name?: string;
  description?: string | null;
  sortOrder?: number;
  isActive?: boolean;
  icon?: string | null;
  iconFile?: PickedImage | null;
  clearCustomIcon?: boolean;
}): FormData | Record<string, unknown> {
  if (fields.iconFile || fields.clearCustomIcon) {
    const fd = new FormData();
    if (fields.name != null) {
      fd.append('name', fields.name);
    }
    if (fields.description != null) {
      fd.append('description', fields.description);
    }
    if (fields.sortOrder != null) {
      fd.append('sortOrder', String(fields.sortOrder));
    }
    if (fields.isActive != null) {
      fd.append('isActive', String(fields.isActive));
    }
    if (fields.icon !== undefined) {
      fd.append('icon', fields.icon ?? '');
    }
    if (fields.iconFile) {
      fd.append('iconImage', {
        uri: fields.iconFile.uri,
        type: fields.iconFile.type || 'image/jpeg',
        name: fields.iconFile.fileName || 'section-icon.jpg',
      } as unknown as Blob);
    }
    if (fields.clearCustomIcon) {
      fd.append('clearCustomIcon', 'true');
    }
    return fd;
  }
  const json: Record<string, unknown> = {};
  if (fields.name != null) {
    json.name = fields.name;
  }
  if (fields.description !== undefined) {
    json.description = fields.description;
  }
  if (fields.sortOrder != null) {
    json.sortOrder = fields.sortOrder;
  }
  if (fields.isActive != null) {
    json.isActive = fields.isActive;
  }
  if (fields.icon !== undefined) {
    json.icon = fields.icon;
  }
  return json;
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  customPreview: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bg },
  customBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  customBtnText: { color: colors.text, fontWeight: '700', fontSize: 12 },
  clearBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  clearText: { color: colors.danger, fontWeight: '700', fontSize: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnOn: {
    borderColor: colors.brand[600],
    backgroundColor: colors.brand[50],
  },
  noneMark: { color: colors.muted, fontWeight: '700', fontSize: 16 },
});
