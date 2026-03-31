/**
 * 配额页分页参数与默认口径。
 * 独立拆出，便于不同配额卡片按需覆盖默认单页数量，也方便回归测试。
 */

export const MAX_ITEMS_PER_PAGE = 25;
export const DEFAULT_QUOTA_PAGED_ROWS = 3;

export const resolveQuotaPagedPageSize = (
  columns: number,
  preferredPageSize?: number
): number => {
  if (typeof preferredPageSize === 'number' && Number.isFinite(preferredPageSize)) {
    return Math.max(1, Math.min(MAX_ITEMS_PER_PAGE, Math.round(preferredPageSize)));
  }

  return Math.max(1, Math.min(columns * DEFAULT_QUOTA_PAGED_ROWS, MAX_ITEMS_PER_PAGE));
};
