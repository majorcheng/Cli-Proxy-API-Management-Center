import type { UsageData } from '@/pages/MonitorPage';

export interface ModelDistributionMetric {
  name: string;
  requests: number;
  tokens: number;
  outputThroughput: number | null;
  throughputSampleCount: number;
}

interface ModelDistributionAccumulator {
  requests: number;
  tokens: number;
  outputTokens: number;
  latencyMs: number;
  throughputSampleCount: number;
}

function normalizeNonNegativeNumber(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * 按“输出 Token / 总耗时”计算单条请求的输出速率。
 * 监控中心这里明确只统计成功且耗时有效的请求，避免失败样本和缺失耗时把口径带偏。
 */
export function calculateOutputThroughput(
  outputTokens: number | null | undefined,
  latencyMs: number | null | undefined,
  failed = false,
): number | null {
  if (failed) return null;

  const normalizedLatencyMs = normalizeNonNegativeNumber(latencyMs);
  if (normalizedLatencyMs <= 0) {
    return null;
  }

  const normalizedOutputTokens =
    typeof outputTokens === 'number' && Number.isFinite(outputTokens) && outputTokens >= 0
      ? outputTokens
      : 0;
  return (normalizedOutputTokens * 1000) / normalizedLatencyMs;
}

function getOrCreateAccumulator(
  accumulators: Record<string, ModelDistributionAccumulator>,
  modelName: string,
): ModelDistributionAccumulator {
  if (!accumulators[modelName]) {
    accumulators[modelName] = {
      requests: 0,
      tokens: 0,
      outputTokens: 0,
      latencyMs: 0,
      throughputSampleCount: 0,
    };
  }

  return accumulators[modelName];
}

function accumulateModelMetric(
  accumulator: ModelDistributionAccumulator,
  detail: UsageData['apis'][string]['models'][string]['details'][number],
): void {
  accumulator.requests += 1;
  accumulator.tokens += detail.tokens.total_tokens || 0;

  const throughput = calculateOutputThroughput(
    detail.tokens.output_tokens || 0,
    typeof detail.latency_ms === 'number' ? detail.latency_ms : null,
    detail.failed,
  );
  if (throughput === null) {
    return;
  }

  accumulator.outputTokens += detail.tokens.output_tokens || 0;
  accumulator.latencyMs += detail.latency_ms || 0;
  accumulator.throughputSampleCount += 1;
}

/**
 * 为模型分布卡片统一构建请求数、Token 数和输出速率三套统计，
 * 这样请求视图、Token 视图和输出速率视图可以共用同一份聚合结果，避免口径漂移。
 */
export function buildModelDistributionMetrics(data: UsageData | null): ModelDistributionMetric[] {
  if (!data?.apis) {
    return [];
  }

  const accumulators: Record<string, ModelDistributionAccumulator> = {};

  Object.values(data.apis).forEach((apiData) => {
    Object.entries(apiData.models).forEach(([modelName, modelData]) => {
      const accumulator = getOrCreateAccumulator(accumulators, modelName);
      modelData.details.forEach((detail) => {
        accumulateModelMetric(accumulator, detail);
      });
    });
  });

  return Object.entries(accumulators).map(([name, accumulator]) => ({
    name,
    requests: accumulator.requests,
    tokens: accumulator.tokens,
    outputThroughput:
      accumulator.throughputSampleCount > 0
        ? (accumulator.outputTokens * 1000) / accumulator.latencyMs
        : null,
    throughputSampleCount: accumulator.throughputSampleCount,
  }));
}

/**
 * 统一格式化输出速率，始终显式带上 Token/s 单位，
 * 让请求日志列和模型输出速率榜单的展示保持一致。
 */
export function formatOutputThroughput(
  throughput: number | null,
  locale = 'en-US',
): string {
  if (throughput === null || !Number.isFinite(throughput)) {
    return '-';
  }

  const precision = throughput >= 100 ? 0 : throughput >= 10 ? 1 : 2;
  const formatter = new Intl.NumberFormat(locale, {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
  return `${formatter.format(throughput)} Token/s`;
}
