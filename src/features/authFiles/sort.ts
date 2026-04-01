import type { AuthFileItem } from '@/types';
import { normalizeProviderKey } from '@/features/authFiles/constants';

export const parseDateLikeValue = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 1e12 ? value * 1000 : value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return 0;

    const asNumber = Number(trimmed);
    if (Number.isFinite(asNumber)) {
      return asNumber < 1e12 ? asNumber * 1000 : asNumber;
    }

    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return 0;
};

export const resolveFirstRegisteredAtMs = (file: AuthFileItem): number => {
  // 默认排序优先按首注时间正序，确保老账号优先展示。
  return parseDateLikeValue(file['first_registered_at'] ?? file['firstRegisteredAt']);
};

export const compareAuthFilesByDefaultSort = (a: AuthFileItem, b: AuthFileItem): number => {
  const firstRegisteredAtA = resolveFirstRegisteredAtMs(a);
  const firstRegisteredAtB = resolveFirstRegisteredAtMs(b);
  const hasFirstRegisteredAtA = firstRegisteredAtA > 0;
  const hasFirstRegisteredAtB = firstRegisteredAtB > 0;

  if (hasFirstRegisteredAtA && hasFirstRegisteredAtB) {
    const firstRegisteredDiff = firstRegisteredAtA - firstRegisteredAtB;
    if (firstRegisteredDiff !== 0) return firstRegisteredDiff;
  } else if (hasFirstRegisteredAtA !== hasFirstRegisteredAtB) {
    // 未知首注时间不应被误判成“最老账号”，因此继续排在已知时间的账号后面。
    return hasFirstRegisteredAtA ? -1 : 1;
  }

  const providerA = normalizeProviderKey(String(a.provider ?? a.type ?? 'unknown'));
  const providerB = normalizeProviderKey(String(b.provider ?? b.type ?? 'unknown'));
  const providerCompare = providerA.localeCompare(providerB);
  if (providerCompare !== 0) return providerCompare;

  return a.name.localeCompare(b.name);
};
