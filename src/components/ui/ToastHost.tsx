import React, { useEffect } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToastStore } from '@/store/toastStore';
import { colors, radius, shadows } from '@/theme';

export function ToastHost() {
  const { visible, message, tone, hide } = useToastStore();
  const insets = useSafeAreaInsets();
  const opacity = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [visible, opacity]);

  if (!visible && !message) {
    return null;
  }

  const bg =
    tone === 'success' ? colors.brand[700] : tone === 'error' ? colors.danger : colors.text;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.wrap, { top: insets.top + 8, opacity }]}>
      <Text onPress={hide} style={[styles.toast, { backgroundColor: bg }]}>
        {message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 50,
    alignItems: 'center',
  },
  toast: {
    color: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radius.md,
    overflow: 'hidden',
    fontWeight: '600',
    textAlign: 'center',
    ...shadows.md,
  },
});
