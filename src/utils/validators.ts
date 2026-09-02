export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isValidPhone(value: string) {
  return /^[0-9]{10}$/.test(value.trim());
}

export function required(value: string, label: string) {
  if (!value.trim()) {
    return `${label} is required`;
  }
  return null;
}
