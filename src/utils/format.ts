export function formatCurrency(value?: number | string | null, currency = '₹') {
  const amount = Number(value ?? 0);
  if (Number.isNaN(amount)) {
    return `${currency}0`;
  }
  return `${currency}${amount.toLocaleString('en-IN', {
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(value?: string | null) {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(value?: string | null) {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function toDisplayString(value: unknown): string {
  if (value == null) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(toDisplayString).filter(Boolean).join(', ');
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const nested = obj.value ?? obj.name ?? obj.label ?? obj.title;
    if (nested != null && nested !== value) {
      return toDisplayString(nested);
    }
  }
  return '';
}

export function pickString(...values: unknown[]) {
  for (const value of values) {
    const text = toDisplayString(value).trim();
    if (text) {
      return text;
    }
  }
  return '';
}

export function pickNumber(...values: unknown[]) {
  for (const value of values) {
    const n = Number(value);
    if (!Number.isNaN(n) && value !== null && value !== undefined && value !== '') {
      return n;
    }
  }
  return 0;
}

export function titleCaseStatus(status?: string | null) {
  if (!status) {
    return 'Unknown';
  }
  return status
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, char => char.toUpperCase());
}

export function getStatusTone(status?: string | null): 'success' | 'warning' | 'danger' | 'info' | 'muted' {
  const value = (status || '').toUpperCase();
  if (['DELIVERED', 'APPROVED', 'ACTIVE', 'COMPLETED', 'CREDITED', 'SUCCESS', 'PAID'].includes(value)) {
    return 'success';
  }
  if (['PENDING', 'PROCESSING', 'ACCEPTED', 'CONFIRMED', 'PLACED'].includes(value)) {
    return 'warning';
  }
  if (['CANCELLED', 'CANCELED', 'REJECTED', 'FAILED', 'INACTIVE'].includes(value)) {
    return 'danger';
  }
  if (['RESPONDED', 'OPEN', 'SHIPPED', 'IN_TRANSIT', 'OUT FOR DELIVERY'].includes(value)) {
    return 'info';
  }
  return 'muted';
}
