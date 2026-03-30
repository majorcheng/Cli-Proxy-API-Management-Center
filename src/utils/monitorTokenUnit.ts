/**
 * 监控中心 Token 图表默认使用 M 作为展示单位。
 * 当前用于「每日用量趋势」和「每小时 Token 趋势」，
 * 避免中高体量数据下纵轴和 tooltip 被大量 K 单位数字挤占。
 */

export const MONITOR_TOKEN_UNIT_DIVISOR = 1_000_000;
export const MONITOR_TOKEN_UNIT_SUFFIX = 'M';

function normalizeFiniteNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

/**
 * 将原始 Token 数换算成图表展示值（单位：M）。
 */
export function convertMonitorTokensToDisplayValue(tokens: number): number {
  return normalizeFiniteNumber(tokens) / MONITOR_TOKEN_UNIT_DIVISOR;
}

/**
 * 将已经换算为 M 单位的数值格式化为展示文本。
 */
export function formatMonitorTokenDisplayValue(
  value: number,
  maximumFractionDigits = 2
): string {
  const normalized = normalizeFiniteNumber(value);
  return `${normalized.toLocaleString(undefined, { maximumFractionDigits })}${MONITOR_TOKEN_UNIT_SUFFIX}`;
}

/**
 * 生成 Token 纵轴标题，例如 Tokens (M)。
 */
export function getMonitorTokenAxisTitle(tokenLabel: string): string {
  return `${tokenLabel} (${MONITOR_TOKEN_UNIT_SUFFIX})`;
}
