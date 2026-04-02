/**
 * 监控中心公共工具函数
 */

import { resolveCodexWeeklyLimit } from '@/features/authFiles/codexWeeklyLimit';
import type { UsageData } from '@/pages/MonitorPage';

/**
 * 日期范围接口
 */
export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * 禁用模型状态接口
 */
export interface DisableState {
  source: string;
  model: string;
  displayName: string;
  step: number;
}

type AuthFileAvailabilityEntry = {
  disabled?: boolean;
  unavailable?: boolean;
  provider?: unknown;
  type?: unknown;
  status_message?: unknown;
  statusMessage?: unknown;
  next_retry_after?: unknown;
  nextRetryAfter?: unknown;
  updated_at?: unknown;
  updatedAt?: unknown;
  modified?: unknown;
};

/**
 * 脱敏 API Key
 * @param key API Key 字符串
 * @returns 脱敏后的字符串
 */
export function maskSecret(key: string): string {
  if (!key || key === '-' || key === 'unknown') return key || '-';
  if (key.length <= 8) {
    return `${key.slice(0, 4)}***`;
  }
  return `${key.slice(0, 4)}***${key.slice(-4)}`;
}

/**
 * 解析渠道名称（返回 provider 名称）
 * @param source 来源标识
 * @param providerMap 渠道映射表
 * @returns provider 名称或 null
 */
export function resolveProvider(
  source: string,
  providerMap: Record<string, string>
): string | null {
  if (!source || source === '-' || source === 'unknown') return null;

  // 首先尝试完全匹配
  if (providerMap[source]) {
    return providerMap[source];
  }

  // 然后尝试前缀匹配（双向）
  const entries = Object.entries(providerMap);
  for (const [key, provider] of entries) {
    if (source.startsWith(key) || key.startsWith(source)) {
      return provider;
    }
  }

  return null;
}

/**
 * 格式化渠道显示名称：渠道名 (脱敏后的api-key)
 * @param source 来源标识
 * @param providerMap 渠道映射表
 * @returns 格式化后的显示名称
 */
export function formatProviderDisplay(
  source: string,
  providerMap: Record<string, string>
): string {
  if (!source || source === '-' || source === 'unknown') {
    return source || '-';
  }
  const provider = resolveProvider(source, providerMap);
  const masked = maskSecret(source);
  if (!provider) return masked;
  return `${provider} (${masked})`;
}

/**
 * 获取渠道显示信息（分离渠道名和秘钥）
 * @param source 来源标识
 * @param providerMap 渠道映射表
 * @returns 包含渠道名和秘钥的对象
 */
export function getProviderDisplayParts(
  source: string,
  providerMap: Record<string, string>
): { provider: string | null; masked: string } {
  if (!source || source === '-' || source === 'unknown') {
    return { provider: null, masked: source || '-' };
  }
  const provider = resolveProvider(source, providerMap);
  const masked = maskSecret(source);
  return { provider, masked };
}

/**
 * 格式化时间戳为日期时间字符串
 * @param timestamp 时间戳（毫秒数或 ISO 字符串）
 * @returns 格式化后的日期时间字符串
 */
export function formatTimestamp(timestamp: number | string): string {
  if (!timestamp) return '-';
  const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * 获取成功率对应的样式类名
 * @param rate 成功率（0-100）
 * @param styles 样式模块对象
 * @returns 样式类名
 */
export function getRateClassName(
  rate: number,
  styles: Record<string, string>
): string {
  if (rate >= 90) return styles.rateHigh || '';
  if (rate >= 70) return styles.rateMedium || '';
  return styles.rateLow || '';
}

/**
 * 检查模型是否在配置中可用（未被移除）
 * @param source 来源标识
 * @param modelAlias 模型别名
 * @param providerModels 渠道模型映射表
 * @returns 是否可用
 */
export function isModelEnabled(
  source: string,
  modelAlias: string,
  providerModels: Record<string, Set<string>>
): boolean {
  if (!source || !modelAlias) return true; // 无法判断时默认显示
  // 首先尝试完全匹配
  if (providerModels[source]) {
    return providerModels[source].has(modelAlias);
  }
  // 然后尝试前缀匹配
  const entries = Object.entries(providerModels);
  for (const [key, modelSet] of entries) {
    if (source.startsWith(key) || key.startsWith(source)) {
      return modelSet.has(modelAlias);
    }
  }
  return true; // 找不到渠道配置时默认显示
}

/**
 * 检查模型是否已禁用（会话中禁用或配置中已移除）
 * @param source 来源标识
 * @param model 模型名称
 * @param disabledModels 已禁用模型集合
 * @param providerModels 渠道模型映射表
 * @returns 是否已禁用
 */
export function isModelDisabled(
  source: string,
  model: string,
  disabledModels: Set<string>,
  providerModels: Record<string, Set<string>>
): boolean {
  // 首先检查会话中是否已禁用
  if (disabledModels.has(`${source}|||${model}`)) {
    return true;
  }
  // 然后检查配置中是否已移除
  return !isModelEnabled(source, model, providerModels);
}

/**
 * 创建禁用状态对象
 * @param source 来源标识
 * @param model 模型名称
 * @param providerMap 渠道映射表
 * @returns 禁用状态对象
 */
export function createDisableState(
  source: string,
  model: string,
  providerMap: Record<string, string>,
): DisableState {
  const providerName = resolveProvider(source, providerMap);
  const displayName = providerName
    ? `${providerName} / ${model}`
    : `${maskSecret(source)} / ${model}`;
  return { source, model, displayName, step: 1 };
}

/**
 * 统计认证文件中的可用数量。
 * 监控中心“号池总数”卡片改成展示“可用/总量”后，需要复用同一套口径：
 * - 手动 disabled 的认证文件不计入可用；
 * - 后端已标记 unavailable 的认证文件也不计入可用。
 * - 已识别为 429/冷却阻断态的 Codex 认证文件也不计入可用。
 */
export function countAvailableAuthFiles(files: unknown[] | null | undefined): number {
  if (!Array.isArray(files)) return 0;

  return files.reduce<number>((count, file) => {
    if (!file || typeof file !== 'object') return count;

    const entry = file as AuthFileAvailabilityEntry;
    const isAvailable =
      entry.disabled !== true &&
      entry.unavailable !== true &&
      !resolveCodexWeeklyLimit(entry).is429Limited;
    return isAvailable ? count + 1 : count;
  }, 0);
}

/**
 * 监控中心预设时间范围
 * - 1: 今天
 * - yesterday: 昨天
 * - 7/14/30: 最近 N 天（包含今天）
 */
export type PresetTimeRange = 1 | 'yesterday' | 7 | 14 | 30;

/**
 * 监控中心时间范围按钮顺序
 * “昨天”固定紧跟在“今天”后，避免页面与卡片内部顺序不一致。
 */
export const MONITOR_PRESET_TIME_RANGES: readonly PresetTimeRange[] = [1, 'yesterday', 7, 14, 30];

/**
 * 时间范围类型
 */
export type TimeRangeValue = PresetTimeRange | 'custom';

/**
 * 计算时间范围的起止边界
 * 数字范围按“包含今天在内的最近 N 个自然日”处理
 * @param timeRange 时间范围（天数或 'custom'）
 * @param customRange 自定义日期范围
 * @param now 当前时间，便于测试或复用
 * @returns 起止时间
 */
export function getTimeRangeBounds(
  timeRange: TimeRangeValue,
  customRange?: DateRange,
  now: Date = new Date()
): DateRange {
  if (timeRange === 'custom' && customRange) {
    return {
      start: new Date(customRange.start.getTime()),
      end: new Date(customRange.end.getTime()),
    };
  }

  if (timeRange === 'yesterday') {
    const start = new Date(now.getTime());
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 1);

    const end = new Date(start.getTime());
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }

  const normalizedRange = typeof timeRange === 'number' && timeRange > 0 ? timeRange : 7;
  const start = new Date(now.getTime());
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (normalizedRange - 1));

  const end = new Date(now.getTime());
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

/**
 * 格式化监控中心预设时间范围标签
 * 顶部页签、KPI 卡片、分布图等都复用这一套文案，避免“昨天”支持出现分叉。
 */
export function formatPresetTimeRangeLabel(
  range: PresetTimeRange,
  t?: (key: string, options?: Record<string, unknown>) => string
): string {
  if (range === 1) {
    return t ? t('monitor.today') : '今天';
  }

  if (range === 'yesterday') {
    return t ? t('monitor.yesterday') : '昨天';
  }

  return t ? t('monitor.last_n_days', { n: range }) : `最近 ${range} 天`;
}

/**
 * 将日期格式化为本地日期键 YYYY-MM-DD
 * @param date 日期对象
 * @returns 本地日期键
 */
export function formatLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 将日期格式化为本地小时键 YYYY-MM-DDTHH
 * @param date 日期对象
 * @returns 本地小时键
 */
export function formatLocalHourKey(date: Date): string {
  return `${formatLocalDateKey(date)}T${String(date.getHours()).padStart(2, '0')}`;
}

/**
 * 解析日期输入框的 YYYY-MM-DD 为本地日期
 * @param value 日期字符串
 * @returns 本地 Date 或 null
 */
export function parseDateInputValue(value: string): Date | null {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

/**
 * 计算小时级图表的本地时间窗口
 * @param hourRange 小时范围
 * @param now 当前时间
 * @returns 小时窗口起止和桶数量
 */
export function getHourlyRangeBounds(
  hourRange: number,
  now: Date = new Date()
): { start: Date; end: Date; bucketCount: number } {
  const bucketCount =
    Number.isFinite(hourRange) && hourRange > 0 ? Math.floor(hourRange) : 24;
  const end = new Date(now.getTime());
  end.setMinutes(0, 0, 0);

  const start = new Date(end.getTime());
  start.setHours(start.getHours() - (bucketCount - 1));

  return { start, end, bucketCount };
}

/**
 * 仅按 API 过滤器过滤数据
 * @param data 原始数据
 * @param apiFilter API 过滤关键词
 * @returns 过滤后的数据
 */
export function filterDataByApiFilter(
  data: UsageData | null,
  apiFilter = ''
): UsageData | null {
  if (!data?.apis) return null;

  const normalizedApiFilter = apiFilter.trim().toLowerCase();
  if (!normalizedApiFilter) {
    return data;
  }

  const filtered: UsageData = { apis: {} };

  Object.entries(data.apis).forEach(([apiKey, apiData]) => {
    if (!apiKey.toLowerCase().includes(normalizedApiFilter)) {
      return;
    }

    if (!apiData?.models) {
      return;
    }

    filtered.apis[apiKey] = apiData;
  });

  return filtered;
}

/**
 * 根据时间范围过滤数据
 * @param data 原始数据
 * @param timeRange 时间范围（天数或 'custom'）
 * @param customRange 自定义日期范围
 * @returns 过滤后的数据
 */
export function filterDataByTimeRange(
  data: UsageData | null,
  timeRange: TimeRangeValue,
  customRange?: DateRange,
  apiFilter = ''
): UsageData | null {
  const apiFilteredData = filterDataByApiFilter(data, apiFilter);
  if (!apiFilteredData?.apis) return null;
  const { start: cutoffStart, end: cutoffEnd } = getTimeRangeBounds(timeRange, customRange);

  const filtered: UsageData = { apis: {} };

  Object.entries(apiFilteredData.apis).forEach(([apiKey, apiData]) => {
    if (!apiData?.models) return;

    const filteredModels: Record<string, { details: UsageData['apis'][string]['models'][string]['details'] }> = {};

    Object.entries(apiData.models).forEach(([modelName, modelData]) => {
      if (!modelData?.details || !Array.isArray(modelData.details)) return;

      const filteredDetails = modelData.details.filter((detail) => {
        const timestamp = new Date(detail.timestamp);
        return timestamp >= cutoffStart && timestamp <= cutoffEnd;
      });

      if (filteredDetails.length > 0) {
        filteredModels[modelName] = { details: filteredDetails };
      }
    });

    if (Object.keys(filteredModels).length > 0) {
      filtered.apis[apiKey] = { models: filteredModels };
    }
  });

  return filtered;
}
