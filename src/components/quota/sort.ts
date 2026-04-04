import type { AuthFileItem, CodexQuotaState } from '@/types';
import { resolveFirstRegisteredAtMs } from '@/features/authFiles/sort';
import { normalizePlanType, resolveCodexPlanType } from '@/utils/quota';

const CODEX_PLAN_ORDER: Record<string, number> = {
  pro: 0,
  plus: 1,
  team: 2,
  free: 3,
};

const UNKNOWN_PLAN_ORDER = 4;

const resolveCodexQuotaPlanType = (
  file: AuthFileItem,
  quotaByName: Record<string, CodexQuotaState>
): string | null => {
  const cachedPlanType = normalizePlanType(quotaByName[file.name]?.planType);
  if (cachedPlanType) return cachedPlanType;
  return resolveCodexPlanType(file);
};

const resolveCodexQuotaPlanOrder = (
  file: AuthFileItem,
  quotaByName: Record<string, CodexQuotaState>
): number => {
  const planType = resolveCodexQuotaPlanType(file, quotaByName);
  if (!planType) return UNKNOWN_PLAN_ORDER;
  return CODEX_PLAN_ORDER[planType] ?? UNKNOWN_PLAN_ORDER;
};

export const compareCodexQuotaFiles = (
  a: AuthFileItem,
  b: AuthFileItem,
  quotaByName: Record<string, CodexQuotaState> = {}
): number => {
  // Codex 配额页先按套餐档位分组，再在组内复用 first_registered_at 语义，
  // 这样既满足“高价值账号优先”，也能保持老账号在前的稳定展示习惯。
  const planOrderDiff =
    resolveCodexQuotaPlanOrder(a, quotaByName) - resolveCodexQuotaPlanOrder(b, quotaByName);
  if (planOrderDiff !== 0) return planOrderDiff;

  const firstRegisteredAtA = resolveFirstRegisteredAtMs(a);
  const firstRegisteredAtB = resolveFirstRegisteredAtMs(b);
  const hasFirstRegisteredAtA = firstRegisteredAtA > 0;
  const hasFirstRegisteredAtB = firstRegisteredAtB > 0;

  if (hasFirstRegisteredAtA && hasFirstRegisteredAtB) {
    const firstRegisteredDiff = firstRegisteredAtA - firstRegisteredAtB;
    if (firstRegisteredDiff !== 0) return firstRegisteredDiff;
  } else if (hasFirstRegisteredAtA !== hasFirstRegisteredAtB) {
    // 未知首注时间仅在本套餐组内靠后，避免把新旧不明的账号插到老账号前面。
    return hasFirstRegisteredAtA ? -1 : 1;
  }

  return a.name.localeCompare(b.name);
};
