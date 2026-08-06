export const PLATE_MAX_LENGTH = 128;

export function normalizePlate(value: unknown) {
  if (typeof value !== 'string') return value;
  const normalized = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, PLATE_MAX_LENGTH);
  return normalized || null;
}
