interface MonitorTokenUsage {
  cached_tokens?: number | null;
  cache_tokens?: number | null;
}

function normalizeNonNegativeTokenCount(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * 监控中心把 usage 明细里的 cached/cache tokens 统一视为“命中 Token”。
 * 这里兼容两种字段名，避免不同快照结构下命中统计不一致。
 */
export function extractMonitorHitTokens(tokens: MonitorTokenUsage | null | undefined): number {
  if (!tokens) return 0;

  return Math.max(
    normalizeNonNegativeTokenCount(tokens.cached_tokens),
    normalizeNonNegativeTokenCount(tokens.cache_tokens)
  );
}

/**
 * 命中 Token 是输入 Token 的子集，因此命中占比按“命中 / 输入”计算，
 * 并限制在 0~100% 范围内，避免异常快照把展示比例冲到 100% 以上。
 */
export function calculateMonitorHitRate(inputTokens: number, hitTokens: number): number {
  const normalizedInputTokens = normalizeNonNegativeTokenCount(inputTokens);
  const normalizedHitTokens = normalizeNonNegativeTokenCount(hitTokens);

  if (normalizedInputTokens <= 0 || normalizedHitTokens <= 0) {
    return 0;
  }

  return Math.min(normalizedHitTokens / normalizedInputTokens, 1);
}

/**
 * 监控页“输入 Token”与请求日志保持同一口径：原始输入减去命中 Token。
 * 命中属于输入子集，因此这里对结果做非负保护，避免异常快照出现负数。
 */
export function calculateMonitorNetInputTokens(inputTokens: number, hitTokens: number): number {
  const normalizedInputTokens = normalizeNonNegativeTokenCount(inputTokens);
  const normalizedHitTokens = normalizeNonNegativeTokenCount(hitTokens);
  return Math.max(normalizedInputTokens - normalizedHitTokens, 0);
}
