import { ENV } from '@/config/env';

/**
 * Turns API image paths into loadable URIs.
 * Relative paths (e.g. uploads/all/foo.jpg) are prefixed with IMAGE_BASE_URL.
 * Absolute http(s) URLs and local file/content/data URIs are left as-is.
 */
export function resolveMediaUrl(path?: string | null): string | undefined {
  if (!path || typeof path !== 'string') {
    return undefined;
  }
  const value = path.trim();
  if (!value) {
    return undefined;
  }
  if (/^(https?:|file:|content:|data:)/i.test(value)) {
    return value;
  }
  const base = ENV.IMAGE_BASE_URL.replace(/\/$/, '');
  const suffix = value.startsWith('/') ? value : `/${value}`;
  return `${base}${suffix}`;
}
