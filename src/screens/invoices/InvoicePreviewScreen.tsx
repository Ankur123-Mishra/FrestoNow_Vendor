import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import { Screen } from '@/components/layout/Screen';
import { AppHeader } from '@/components/ui/AppHeader';
import { counterService } from '@/api/services';
import { ENV } from '@/config/env';
import { useToastStore } from '@/store/toastStore';
import { colors, radius } from '@/theme';
import { getErrorMessage } from '@/utils/apiHelpers';
import type { InvoicePreviewRoute } from '@/types';

export function InvoicePreviewScreen() {
  const route = useRoute<InvoicePreviewRoute>();
  const { orderId, format, orderNumber } = route.params;
  const showToast = useToastStore(s => s.show);
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isThermal = format === 'thermal';
  const title = isThermal ? '80mm invoice' : 'A4 invoice';
  const subtitle = orderNumber ? `#${orderNumber}` : `Order #${orderId}`;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const body = await counterService.fetchInvoiceHtml(orderId, format, 'store');
      if (!body.trim()) {
        throw new Error('Invoice came back empty');
      }
      setHtml(body);
    } catch (err) {
      const message = getErrorMessage(err, 'Could not load invoice');
      setError(message);
      setHtml(null);
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [format, orderId, showToast]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <Screen padded={false}>
      <View style={styles.headerPad}>
        <AppHeader title={title} subtitle={subtitle} showBack />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand[600]} size="large" />
          <Text style={styles.hint}>Loading {isThermal ? '80mm' : 'A4'} GST invoice…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={load} style={({ pressed }) => [styles.retry, pressed && styles.pressed]}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : html ? (
        <View style={[styles.webWrap, isThermal && styles.webWrapThermal]}>
          <WebView
            originWhitelist={['*']}
            source={{ html, baseUrl: ENV.IMAGE_BASE_URL }}
            style={styles.web}
            startInLoadingState
            scalesPageToFit
            setSupportMultipleWindows={false}
            renderLoading={() => (
              <View style={styles.webLoading}>
                <ActivityIndicator color={colors.brand[600]} />
              </View>
            )}
          />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerPad: { paddingHorizontal: 16 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  hint: { color: colors.muted, fontWeight: '600', fontSize: 13, textAlign: 'center' },
  errorText: { color: colors.danger, fontWeight: '700', textAlign: 'center', fontSize: 14 },
  retry: {
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.brand[50],
  },
  retryText: { color: colors.brand[800], fontWeight: '700' },
  pressed: { opacity: 0.88 },
  webWrap: {
    flex: 1,
    marginHorizontal: 8,
    marginBottom: 8,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  webWrapThermal: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 360,
  },
  web: { flex: 1, backgroundColor: colors.white },
  webLoading: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
});
