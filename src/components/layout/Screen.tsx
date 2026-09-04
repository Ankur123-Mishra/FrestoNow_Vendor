import React from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/theme';
import { useResponsive } from '@/utils/responsive';

interface Props {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  style?: ViewStyle;
}

export function Screen({ children, scroll = false, padded = true, style }: Props) {
  const insets = useSafeAreaInsets();
  const { horizontalPad, isTablet } = useResponsive();
  const paddingTop = Math.max(insets.top, 12);

  if (scroll) {
    return (
      <View style={styles.root}>
        <ScrollView
          style={styles.root}
          contentContainerStyle={[
            styles.scroll,
            { paddingTop, paddingBottom: insets.bottom + 24 },
            padded && { paddingHorizontal: horizontalPad },
            isTablet && styles.tablet,
            style,
          ]}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          removeClippedSubviews={false}
          automaticallyAdjustKeyboardInsets>
          {children}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop }]}>
      <View
        style={[
          styles.inner,
          padded && { paddingHorizontal: horizontalPad },
          isTablet && styles.tablet,
          style,
        ]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  inner: { flex: 1 },
  scroll: { flexGrow: 1 },
  tablet: { alignSelf: 'center', width: '100%', maxWidth: 720 },
});
