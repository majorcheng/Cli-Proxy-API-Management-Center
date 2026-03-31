/**
 * 认证文件页分页参数集中定义。
 * 单独拆出便于页面复用，也方便做独立回归测试。
 */

export const MIN_CARD_PAGE_SIZE = 3;
export const MAX_CARD_PAGE_SIZE = 100;
export const DEFAULT_REGULAR_CARD_PAGE_SIZE = 100;
export const DEFAULT_COMPACT_CARD_PAGE_SIZE = 100;
export const LEGACY_DEFAULT_REGULAR_CARD_PAGE_SIZE = 9;
export const LEGACY_DEFAULT_COMPACT_CARD_PAGE_SIZE = 12;

export const clampCardPageSize = (value: number) =>
  Math.min(MAX_CARD_PAGE_SIZE, Math.max(MIN_CARD_PAGE_SIZE, Math.round(value)));

export const isLegacyDefaultCardPageSize = (value: number | null | undefined): boolean => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return false;
  }

  const normalized = clampCardPageSize(value);
  return (
    normalized === LEGACY_DEFAULT_REGULAR_CARD_PAGE_SIZE ||
    normalized === LEGACY_DEFAULT_COMPACT_CARD_PAGE_SIZE
  );
};

/**
 * 将旧版本默认分页值视为“未显式自定义”，升级后自动迁移到新的默认值 100。
 * 若用户确实设置了其他自定义值，则仍然保留。
 */
export const resolveAuthFilesPageSize = (
  value: number | null | undefined,
  defaultValue: number
): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return defaultValue;
  }

  const normalized = clampCardPageSize(value);
  if (isLegacyDefaultCardPageSize(normalized)) {
    return defaultValue;
  }
  return normalized;
};
