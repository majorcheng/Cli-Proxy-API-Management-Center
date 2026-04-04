import type { AuthFileItem, CodexQuotaState } from '@/types';
import { compareCodexAuthFilesByPlanAndFirstRegisteredAt } from '@/features/authFiles/sort';

export const compareCodexQuotaFiles = (
  a: AuthFileItem,
  b: AuthFileItem,
  quotaByName: Record<string, CodexQuotaState> = {}
): number => {
  // 配额页优先使用已抓取到的 planType，拿不到时再回退 auth file 自带字段，
  // 保持和认证文件页一致的套餐优先级与首注时间语义。
  return compareCodexAuthFilesByPlanAndFirstRegisteredAt(
    a,
    b,
    (file) => quotaByName[file.name]?.planType
  );
};
