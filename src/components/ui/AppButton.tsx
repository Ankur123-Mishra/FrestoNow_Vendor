import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native';
import { colors, radius, shadows } from '@/theme';
import { moderateScale } from '@/utils/responsive';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';

interface Props {
  title: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: Variant;
  style?: ViewStyle;
}

export function AppButton({
  title,
  onPress,
  loading,
  disabled,
  variant = 'primary',
  style,
}: Props) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? colors.white : colors.brand[700]} />
      ) : (
        <Text style={[styles.text, variant !== 'primary' && variant !== 'danger' && styles.textDark]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 50,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    ...shadows.sm,
  },
  primary: { backgroundColor: colors.brand[600] },
  secondary: { backgroundColor: colors.brand[50] },
  ghost: { backgroundColor: 'transparent', elevation: 0, shadowOpacity: 0 },
  danger: { backgroundColor: colors.danger },
  outline: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    elevation: 0,
    shadowOpacity: 0,
  },
  pressed: { opacity: 0.88 },
  disabled: { opacity: 0.55 },
  text: {
    color: colors.white,
    fontSize: moderateScale(15),
    fontWeight: '700',
  },
  textDark: { color: colors.brand[800] },
});
