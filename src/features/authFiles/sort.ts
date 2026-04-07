import type { AuthFileItem } from '@/types';
import { normalizeProviderKey, parsePriorityValue } from '@/features/authFiles/constants';
import { normalizePlanType, resolveCodexPlanType } from '@/utils/quota';

const CODEX_PLAN_ORDER: Record<string, number> = {
  pro: 0,
  plus: 1,
  team: 2,
  free: 3,
};

const UNKNOWN_CODEX_PLAN_ORDER = 4;

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

export const compareAuthFilesByFirstRegisteredAt = (
  a: AuthFileItem,
  b: AuthFileItem
): number => {
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

  return 0;
};

const resolveCodexPlanOrder = (
  file: AuthFileItem,
  resolvePlanType?: (file: AuthFileItem) => unknown
): number => {
  const overriddenPlanType = resolvePlanType ? normalizePlanType(resolvePlanType(file)) : null;
  const planType = overriddenPlanType ?? resolveCodexPlanType(file);
  if (!planType) return UNKNOWN_CODEX_PLAN_ORDER;
  return CODEX_PLAN_ORDER[planType] ?? UNKNOWN_CODEX_PLAN_ORDER;
};

export const compareCodexAuthFilesByPlanAndFirstRegisteredAt = (
  a: AuthFileItem,
  b: AuthFileItem,
  resolvePlanType?: (file: AuthFileItem) => unknown
): number => {
  const planOrderDiff =
    resolveCodexPlanOrder(a, resolvePlanType) - resolveCodexPlanOrder(b, resolvePlanType);
  if (planOrderDiff !== 0) return planOrderDiff;

  const firstRegisteredDiff = compareAuthFilesByFirstRegisteredAt(a, b);
  if (firstRegisteredDiff !== 0) return firstRegisteredDiff;

  return a.name.localeCompare(b.name);
};

const resolveAuthFilePriority = (file: AuthFileItem): number =>
  parsePriorityValue(file.priority ?? file['priority']) ?? 0;

export const compareAuthFilesByPriority = (a: AuthFileItem, b: AuthFileItem): number => {
  // 默认排序先对齐 CPA 的 priority 语义：数值越大，表示越应该优先被使用和展示。
  return resolveAuthFilePriority(b) - resolveAuthFilePriority(a);
};

export const compareAuthFilesByDefaultSort = (a: AuthFileItem, b: AuthFileItem): number => {
  const priorityDiff = compareAuthFilesByPriority(a, b);
  if (priorityDiff !== 0) return priorityDiff;

  const providerA = normalizeProviderKey(String(a.provider ?? a.type ?? 'unknown'));
  const providerB = normalizeProviderKey(String(b.provider ?? b.type ?? 'unknown'));

  if (providerA === 'codex' && providerB === 'codex') {
    const codexCompare = compareCodexAuthFilesByPlanAndFirstRegisteredAt(a, b);
    if (codexCompare !== 0) return codexCompare;
  }

  const firstRegisteredDiff = compareAuthFilesByFirstRegisteredAt(a, b);
  if (firstRegisteredDiff !== 0) return firstRegisteredDiff;

  const providerCompare = providerA.localeCompare(providerB);
  if (providerCompare !== 0) return providerCompare;

  return a.name.localeCompare(b.name);
};
