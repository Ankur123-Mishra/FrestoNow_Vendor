import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { colors, radius } from '@/theme';
import { moderateScale } from '@/utils/responsive';

interface Props extends TextInputProps {
  label: string;
  error?: string | null;
  optional?: boolean;
}

export const AppInput = React.memo(function AppInput({
  label,
  error,
  optional,
  secureTextEntry,
  style,
  ...rest
}: Props) {
  const [hidden, setHidden] = useState(Boolean(secureTextEntry));

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {optional ? <Text style={styles.optional}>Optional</Text> : null}
      </View>
      <View style={[styles.field, error ? styles.fieldError : null]}>
        <TextInput
          placeholderTextColor={colors.muted}
          secureTextEntry={secureTextEntry ? hidden : false}
          style={[styles.input, style]}
          {...rest}
        />
        {secureTextEntry ? (
          <Pressable onPress={() => setHidden(v => !v)} hitSlop={10} style={styles.eye}>
            {hidden ? (
              <Eye size={18} color={colors.muted} />
            ) : (
              <EyeOff size={18} color={colors.muted} />
            )}
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  label: {
    color: colors.textSecondary,
    fontSize: moderateScale(13),
    fontWeight: '600',
  },
  optional: { color: colors.muted, fontSize: 12 },
  field: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  fieldError: { borderColor: colors.danger },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: moderateScale(15),
    paddingVertical: 12,
  },
  eye: { paddingLeft: 8 },
  error: { color: colors.danger, marginTop: 4, fontSize: 12 },
});
