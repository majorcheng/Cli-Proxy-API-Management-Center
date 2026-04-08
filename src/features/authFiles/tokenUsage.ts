import type { AuthFileItem } from '@/types';
import {
  extractTotalTokens,
  normalizeAuthIndex,
  normalizeUsageSourceId,
  type UsageDetail,
} from '@/utils/usage';
import { resolveAuthFileUsedTokensWindow } from '@/features/authFiles/codexWeeklyLimit';

type TokenWindowSum = {
  matched: boolean;
  totalTokens: number;
};

const resolveDetailTimestampMs = (detail: UsageDetail): number =>
  typeof detail.__timestampMs === 'number' ? detail.__timestampMs : Date.parse(detail.timestamp);

const sumUsageTokensInWindow = (
  details: UsageDetail[] | undefined,
  startMs: number,
  endMs: number
): TokenWindowSum => {
  if (!details || details.length === 0) {
    return { matched: false, totalTokens: 0 };
  }

  let matched = false;
  let totalTokens = 0;

  details.forEach((detail) => {
    const timestampMs = resolveDetailTimestampMs(detail);
    if (!Number.isFinite(timestampMs) || timestampMs < startMs || timestampMs > endMs) {
      return;
    }
    matched = true;
    totalTokens += extractTotalTokens(detail);
  });

  return { matched, totalTokens };
};

const appendUsageDetail = (
  map: Map<string, UsageDetail[]>,
  key: string | null,
  detail: UsageDetail
) => {
  if (!key) return;
  const bucket = map.get(key);
  if (bucket) {
    bucket.push(detail);
    return;
  }
  map.set(key, [detail]);
};

export function buildAuthFileUsedTokensMap(
  files: AuthFileItem[],
  usageDetails: UsageDetail[],
  nowMs: number = Date.now()
): Map<string, number> {
  const result = new Map<string, number>();
  const usageDetailsByAuthIndex = new Map<string, UsageDetail[]>();
  const usageDetailsBySource = new Map<string, UsageDetail[]>();

  usageDetails.forEach((detail) => {
    appendUsageDetail(usageDetailsByAuthIndex, normalizeAuthIndex(detail.auth_index), detail);
    appendUsageDetail(usageDetailsBySource, detail.source || null, detail);
  });

  files.forEach((file) => {
    const fileName = String(file.name ?? '').trim();
    if (!fileName) return;

    const { startMs, endMs } = resolveAuthFileUsedTokensWindow(file, nowMs);
    const authIndexKey = normalizeAuthIndex(file['auth_index'] ?? file.authIndex);

    // 优先走 auth_index，确保成功/失败趋势与已用量尽量基于同一 credential 归属。
    if (authIndexKey) {
      const byAuthIndex = sumUsageTokensInWindow(
        usageDetailsByAuthIndex.get(authIndexKey),
        startMs,
        endMs
      );
      if (byAuthIndex.matched) {
        result.set(fileName, byAuthIndex.totalTokens);
        return;
      }
    }

    // 没有 auth_index 命中时，再回退到文件名/source 口径，保持与旧卡牌的展示兼容。
    const exactSourceKey = normalizeUsageSourceId(fileName);
    const byExactName = sumUsageTokensInWindow(
      exactSourceKey ? usageDetailsBySource.get(exactSourceKey) : undefined,
      startMs,
      endMs
    );
    if (byExactName.matched) {
      result.set(fileName, byExactName.totalTokens);
      return;
    }

    const fileNameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
    if (fileNameWithoutExt && fileNameWithoutExt !== fileName) {
      const fallbackSourceKey = normalizeUsageSourceId(fileNameWithoutExt);
      const byNameWithoutExt = sumUsageTokensInWindow(
        fallbackSourceKey ? usageDetailsBySource.get(fallbackSourceKey) : undefined,
        startMs,
        endMs
      );
      if (byNameWithoutExt.matched) {
        result.set(fileName, byNameWithoutExt.totalTokens);
        return;
      }
    }

    result.set(fileName, 0);
  });

  return result;
}
