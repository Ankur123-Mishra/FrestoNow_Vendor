import { apiClient } from '@/api/client';
import { endpoints } from '@/api/endpoints';
import { getActiveModule } from '@/store/moduleStore';

export interface CounterInvoiceItem {
  productId: number | string;
  variantId?: number | string;
  quantity: number;
}

export interface CounterInvoicePayload {
  moduleType?: string;
  customerName?: string;
  customerPhone?: string;
  paymentMethod: string;
  paymentReference?: string;
  amountTendered?: number;
  discount?: number;
  idempotencyKey?: string;
  items: CounterInvoiceItem[];
}

export const counterService = {
  lookupVariant(code: string, moduleType: string = getActiveModule()) {
    return apiClient.get(endpoints.catalog.variantLookup, {
      params: { code, moduleType },
    });
  },

  createInvoice(payload: CounterInvoicePayload) {
    const moduleType = payload.moduleType || getActiveModule();
    const headers: Record<string, string> = {};
    if (payload.idempotencyKey) {
      headers['Idempotency-Key'] = payload.idempotencyKey;
    }
    return apiClient.post(
      endpoints.orders.counterInvoices,
      { ...payload, moduleType },
      { headers },
    );
  },

  listInvoices(params?: { moduleType?: string; limit?: number }) {
    return apiClient.get(endpoints.orders.list, {
      params: {
        moduleType: params?.moduleType || getActiveModule(),
        limit: params?.limit ?? 50,
        channel: 'POS',
      },
    });
  },

  getInvoiceUrl(
    orderId: string | number,
    format: 'html' | 'pdf' | 'thermal' = 'html',
    sellerMode: 'store' | 'platform' = 'store',
  ) {
    return `${endpoints.orders.invoice(orderId)}?format=${format}&sellerMode=${sellerMode}`;
  },

  /** Fetch GST invoice HTML (A4 = html, 80mm = thermal) with Bearer auth. */
  async fetchInvoiceHtml(
    orderId: string | number,
    format: 'html' | 'thermal' = 'html',
    sellerMode: 'store' | 'platform' = 'store',
  ) {
    const res = await apiClient.get<string>(endpoints.orders.invoice(orderId), {
      params: { format, sellerMode },
      responseType: 'text',
      headers: { Accept: 'text/html,application/xhtml+xml' },
      transformResponse: [(data: unknown) => data],
    });
    return String(res.data ?? '');
  },
};
