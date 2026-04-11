import type { AuthFileItem } from '@/types';
import {
  extractTotalTokens,
  normalizeAuthIndex,
  normalizeUsageSourceId,
  summarizePricingFromDetails,
  type ModelPrice,
  type UsageDetail,
} from '@/utils/usage';
import { resolveAuthFileUsedTokensWindow } from '@/features/authFiles/codexWeeklyLimit';

export type AuthFileUsageSummary = {
  matched: boolean;
  totalTokens: number;
  totalCost: number;
  pricedRequestCount: number;
  unpricedRequestCount: number;
  unpricedModels: string[];
};

const EMPTY_USAGE_SUMMARY: AuthFileUsageSummary = {
  matched: false,
  totalTokens: 0,
  totalCost: 0,
  pricedRequestCount: 0,
  unpricedRequestCount: 0,
  unpricedModels: []
};

const resolveDetailTimestampMs = (detail: UsageDetail): number =>
  typeof detail.__timestampMs === 'number' ? detail.__timestampMs : Date.parse(detail.timestamp);

const collectUsageDetailsInWindow = (
  details: UsageDetail[] | undefined,
  startMs: number,
  endMs: number
): UsageDetail[] => {
  if (!details || details.length === 0) {
    return [];
  }

  return details.filter((detail) => {
    const timestampMs = resolveDetailTimestampMs(detail);
    return Number.isFinite(timestampMs) && timestampMs >= startMs && timestampMs <= endMs;
  });
};

const summarizeUsageInWindow = (
  details: UsageDetail[] | undefined,
  startMs: number,
  endMs: number,
  modelPrices: Record<string, ModelPrice>
): AuthFileUsageSummary => {
  const matchedDetails = collectUsageDetailsInWindow(details, startMs, endMs);
  if (matchedDetails.length === 0) {
    return EMPTY_USAGE_SUMMARY;
  }

  const pricingSummary = summarizePricingFromDetails(matchedDetails, modelPrices);
  return {
    matched: true,
    totalTokens: matchedDetails.reduce((sum, detail) => sum + extractTotalTokens(detail), 0),
    totalCost: pricingSummary.totalCost,
    pricedRequestCount: pricingSummary.pricedRequestCount,
    unpricedRequestCount: pricingSummary.unpricedRequestCount,
    unpricedModels: pricingSummary.unpricedModels
  };
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

export function buildAuthFileUsageSummaryMap(
  files: AuthFileItem[],
  usageDetails: UsageDetail[],
  modelPrices: Record<string, ModelPrice>,
  nowMs: number = Date.now()
): Map<string, AuthFileUsageSummary> {
  const result = new Map<string, AuthFileUsageSummary>();
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

    // 优先走 auth_index，确保已用量与花费都尽量基于同一 credential 归属。
    if (authIndexKey) {
      const byAuthIndex = summarizeUsageInWindow(
        usageDetailsByAuthIndex.get(authIndexKey),
        startMs,
        endMs,
        modelPrices
      );
      if (byAuthIndex.matched) {
        result.set(fileName, byAuthIndex);
        return;
      }
    }

    // 没有 auth_index 命中时，再回退到文件名/source 口径，保持与旧卡牌展示兼容。
    const exactSourceKey = normalizeUsageSourceId(fileName);
    const byExactName = summarizeUsageInWindow(
      exactSourceKey ? usageDetailsBySource.get(exactSourceKey) : undefined,
      startMs,
      endMs,
      modelPrices
    );
    if (byExactName.matched) {
      result.set(fileName, byExactName);
      return;
    }

    const fileNameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
    if (fileNameWithoutExt && fileNameWithoutExt !== fileName) {
      const fallbackSourceKey = normalizeUsageSourceId(fileNameWithoutExt);
      const byNameWithoutExt = summarizeUsageInWindow(
        fallbackSourceKey ? usageDetailsBySource.get(fallbackSourceKey) : undefined,
        startMs,
        endMs,
        modelPrices
      );
      if (byNameWithoutExt.matched) {
        result.set(fileName, byNameWithoutExt);
        return;
      }
    }

    result.set(fileName, EMPTY_USAGE_SUMMARY);
  });

  return result;
}

export function buildAuthFileUsedTokensMap(
  files: AuthFileItem[],
  usageDetails: UsageDetail[],
  nowMs: number = Date.now()
): Map<string, number> {
  const usageSummaryMap = buildAuthFileUsageSummaryMap(files, usageDetails, {}, nowMs);
  return new Map(
    Array.from(usageSummaryMap.entries()).map(([fileName, summary]) => [fileName, summary.totalTokens])
  );
}
