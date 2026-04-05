import type { AuthFileItem } from '@/types';
import { calculateStatusBarData, normalizeAuthIndex, type UsageDetail } from '@/utils/usage';

export type AuthFileStatusBarData = ReturnType<typeof calculateStatusBarData>;

export const buildAuthFilesStatusBarCache = (
  files: AuthFileItem[],
  usageDetails: UsageDetail[]
): Map<string, AuthFileStatusBarData> => {
  const cache = new Map<string, AuthFileStatusBarData>();
  const usageDetailsByAuthIndex = new Map<string, UsageDetail[]>();

  // 先按 auth_index 建索引，避免每个卡片重复扫描整份 usage 明细。
  usageDetails.forEach((detail) => {
    const authIndexKey = normalizeAuthIndex(detail.auth_index);
    if (!authIndexKey) return;

    const existing = usageDetailsByAuthIndex.get(authIndexKey);
    if (existing) {
      existing.push(detail);
      return;
    }

    usageDetailsByAuthIndex.set(authIndexKey, [detail]);
  });

  const uniqueAuthIndexKeys = new Set<string>();
  files.forEach((file) => {
    const rawAuthIndex = file['auth_index'] ?? file.authIndex;
    const authIndexKey = normalizeAuthIndex(rawAuthIndex);
    if (!authIndexKey) return;
    uniqueAuthIndexKeys.add(authIndexKey);
  });

  uniqueAuthIndexKeys.forEach((authIndexKey) => {
    cache.set(
      authIndexKey,
      calculateStatusBarData(usageDetailsByAuthIndex.get(authIndexKey) ?? [])
    );
  });

  return cache;
};
