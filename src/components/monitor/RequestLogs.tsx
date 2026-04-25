import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { usageApi, authFilesApi } from '@/services/api';
import {
  calculateCost,
  loadModelPrices,
  normalizeUsageSourceId,
  normalizeAuthIndex,
} from '@/utils/usage';
import { normalizeRequestClientIp } from '@/utils/requestLogClientIp';
import { calculateOutputThroughput, formatOutputThroughput } from '@/utils/monitorThroughput';
import {
  extractMonitorHitTokens,
  calculateMonitorHitRate,
  calculateMonitorNetInputTokens,
} from '@/utils/monitorTokenStats';
import { normalizeOpenAIProviderBaseUrl, resolveSourceDisplay } from '@/utils/sourceResolver';
import type { SourceInfo, CredentialInfo } from '@/types/sourceInfo';
import {
  maskSecret,
  formatTimestamp,
  getProviderDisplayParts,
  filterDataByTimeRange,
  type PresetTimeRange,
} from '@/utils/monitor';
import type { UsageData } from '@/pages/MonitorPage';
import styles from '@/pages/MonitorPage.module.scss';

interface RequestLogsProps {
  data: UsageData | null;
  loading: boolean;
  timeRange: PresetTimeRange;
  providerMap: Record<string, string>;
  providerTypeMap: Record<string, string>;
  sourceInfoMap: Map<string, SourceInfo>;
  authFileMap?: Map<string, CredentialInfo>;
  apiFilter: string;
}

interface LogEntry {
  id: string;
  timestamp: string;
  timestampMs: number;
  latencyMs: number | null;
  apiKey: string;
  model: string;
  reasoningEffort: string;
  source: string;
  displayName: string;
  providerName: string | null;
  providerType: string;
  providerBaseUrl: string;
  maskedKey: string;
  failed: boolean;
  requestType: string;
  firstTokenMs: number | null;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  hitRate: number;
  outputThroughput: number | null;
  cost: number | null;
  clientIp: string;
  userAgent: string;
}

// 请求日志仅展示最近 36 条，避免页面出现双层纵向滚动
const MAX_VISIBLE_LOGS = 36;

interface ChannelModelRequest {
  failed: boolean;
  timestamp: number;
}

interface PrecomputedStats {
  recentRequests: ChannelModelRequest[];
}

// 监控表格把模型与思考挡位合并展示，方便直接按单条请求识别完整组合。
const formatModelWithEffort = (model: string, reasoningEffort: string) => {
  const normalizedModel = model.trim() || '-';
  const normalizedEffort = reasoningEffort.trim();
  return normalizedEffort ? `${normalizedModel}(${normalizedEffort})` : normalizedModel;
};

// 请求模型列只保留文字颜色：成功沿用正文色，失败使用错误色，避免额外背景干扰。
const getModelTextClassName = (failed: boolean) =>
  `${styles.modelStatusText} ${failed ? styles.modelStatusFailed : styles.modelStatusNormal}`;

// 请求渠道搜索只匹配渠道列相关文本，避免和模型、状态等筛选意图串扰。
const normalizeChannelSearchText = (value: string) => value.trim().toLowerCase();

// 渠道列可能展示名称、脱敏凭据或链接地址，这里统一纳入搜索候选。
const isChannelMatchedBySearch = (entry: LogEntry, keyword: string) => {
  const normalizedKeyword = normalizeChannelSearchText(keyword);
  if (!normalizedKeyword) return true;

  return [
    entry.source,
    entry.displayName,
    entry.providerName ?? '',
    entry.providerBaseUrl,
    entry.maskedKey,
  ].some((value) => normalizeChannelSearchText(value).includes(normalizedKeyword));
};

// TOKEN 合并列统一复用图标，便于在一格里同时表达净输入、输出与缓存读取。
const TOKEN_CELL_ITEMS = [
  { key: 'input', icon: '⬆', className: styles.tokenMetricInput, iconClassName: styles.tokenMetricInputIcon },
  { key: 'output', icon: '⬇', className: styles.tokenMetricOutput, iconClassName: styles.tokenMetricOutputIcon },
  { key: 'cache', icon: '■', className: styles.tokenMetricCache, iconClassName: styles.tokenMetricCacheIcon },
] as const;

// 单条金额只对已定价模型显示数值，缺少价格配置时保留占位符。
const formatRequestCost = (cost: number | null) => {
  if (cost === null) {
    return '--';
  }
  return `$${cost.toLocaleString(undefined, {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  })}`;
};

// 请求类型按后端 usage 的规范值展示为本地化语义，未知值保留原始文本便于排障。
const formatRequestType = (requestType: string, translate: (key: string) => string) => {
  switch (requestType) {
    case 'sync':
      return translate('monitor.logs.request_type_sync');
    case 'stream':
      return translate('monitor.logs.request_type_stream');
    case 'websocket':
      return translate('monitor.logs.request_type_websocket');
    default:
      return requestType || '-';
  }
};

// 后端已经做过 UA 归一化，前端继续 trim 一次以兼容旧快照与手工导入数据。
const normalizeUserAgentDisplay = (userAgent: unknown) =>
  typeof userAgent === 'string' ? userAgent.trim() : '';

// 首 token 耗时只展示正数；0 代表后端没有记录到有效首包时间。
const normalizeFirstTokenMs = (firstTokenMs: unknown): number | null => {
  if (typeof firstTokenMs !== 'number' || !Number.isFinite(firstTokenMs)) {
    return null;
  }
  return firstTokenMs > 0 ? firstTokenMs : null;
};

export function RequestLogs({ data, loading: parentLoading, timeRange, providerMap, providerTypeMap, sourceInfoMap, authFileMap: propAuthFileMap, apiFilter }: RequestLogsProps) {
  const { t, i18n } = useTranslation();
  const [filterApi, setFilterApi] = useState('');
  const [filterModel, setFilterModel] = useState('');
  const [sourceSearchQuery, setSourceSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'' | 'success' | 'failed'>('');
  const [filterProviderType, setFilterProviderType] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(10);
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // 用 ref 存储 fetchLogData，避免作为定时器 useEffect 的依赖
  const fetchLogDataRef = useRef<() => Promise<void>>(() => Promise.resolve());

  // 日志独立数据状态
  const [logData, setLogData] = useState<UsageData | null>(null);
  const [logLoading, setLogLoading] = useState(false);
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  // 认证文件映射（优先使用 prop，否则自行加载）
  const [localAuthFileMap, setLocalAuthFileMap] = useState<Map<string, CredentialInfo>>(new Map());
  const authFileMap = propAuthFileMap?.size ? propAuthFileMap : localAuthFileMap;

  // 使用日志独立数据或父组件数据
  const effectiveData = logData || data;
  // 只在首次加载且没有数据时显示 loading 状态
  const showLoading = (parentLoading && isFirstLoad && !effectiveData) || (logLoading && !effectiveData);
  const modelPrices = useMemo(() => loadModelPrices(), []);

  // 当父组件数据加载完成时，标记首次加载完成
  useEffect(() => {
    if (!parentLoading && data) {
      setIsFirstLoad(false);
    }
  }, [parentLoading, data]);

  // 加载认证文件映射（用于 resolveSourceDisplay）
  const loadAuthFileMap = useCallback(async () => {
    try {
      const response = await authFilesApi.list();
      const files = response?.files || [];
      const credMap = new Map<string, CredentialInfo>();
      files.forEach((file) => {
        const credKey = normalizeAuthIndex((file as Record<string, unknown>)['auth_index'] ?? file.authIndex);
        if (credKey) {
          credMap.set(credKey, {
            name: file.name || credKey,
            type: ((file as Record<string, unknown>).type || (file as Record<string, unknown>).provider || '').toString()
          });
        }
      });
      setLocalAuthFileMap(credMap);
    } catch (err) {
      console.warn('Failed to load auth files for index mapping:', err);
    }
  }, []);

  // 初始加载认证文件映射
  useEffect(() => {
    loadAuthFileMap();
  }, [loadAuthFileMap]);

  // 独立获取日志数据
  const fetchLogData = useCallback(async () => {
    setLogLoading(true);
    try {
      const response = await usageApi.getUsage();
      const usageData = (response?.usage ?? response) as UsageData;
      setLogData(filterDataByTimeRange(usageData, timeRange, undefined, apiFilter));
    } catch (err) {
      console.error('日志刷新失败：', err);
    } finally {
      setLogLoading(false);
    }
  }, [timeRange, apiFilter]);

  // 同步 fetchLogData 到 ref，确保定时器始终调用最新版本
  useEffect(() => {
    fetchLogDataRef.current = fetchLogData;
  }, [fetchLogData]);

  // 统一的自动刷新定时器管理
  useEffect(() => {
    // 清理旧定时器
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    // 禁用自动刷新时
    if (autoRefresh <= 0) {
      setCountdown(0);
      return;
    }

    // 设置初始倒计时
    setCountdown(autoRefresh);

    // 创建新定时器
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // 倒计时结束，触发刷新并重置倒计时
          fetchLogDataRef.current();
          return autoRefresh;
        }
        return prev - 1;
      });
    }, 1000);

    // 组件卸载或 autoRefresh 变化时清理
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  }, [autoRefresh]);

  // 页面时间范围或 API 过滤变化时，日志卡片同步刷新自身数据；
  // 先清空局部缓存，优先回落到父组件已经算好的 filteredData，避免短暂展示旧范围数据。
  const skipInitialFetch = useRef(true);
  useEffect(() => {
    if (skipInitialFetch.current) {
      skipInitialFetch.current = false;
      return;
    }
    setLogData(null);
    fetchLogData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange, apiFilter]);

  const getCountdownText = () => {
    if (logLoading) {
      return t('monitor.logs.refreshing');
    }
    if (autoRefresh === 0) {
      return t('monitor.logs.manual_refresh');
    }
    if (countdown > 0) {
      return t('monitor.logs.refresh_in_seconds', { seconds: countdown });
    }
    return t('monitor.logs.refreshing');
  };

  // 将 usage 明细转换为请求日志条目，并在这里一次性算好输出速率，避免渲染阶段重复分支判断。
  const logEntries = useMemo(() => {
    if (!effectiveData?.apis) return [];

    const entries: LogEntry[] = [];
    let idCounter = 0;
    const normalizeCache = new Map<string, string>();

    Object.entries(effectiveData.apis).forEach(([apiKey, apiData]) => {
      Object.entries(apiData.models).forEach(([modelName, modelData]) => {
        modelData.details.forEach((detail) => {
          const source = detail.source || 'unknown';
          const { masked } = getProviderDisplayParts(source, providerMap);
          const timestampMs = detail.timestamp ? new Date(detail.timestamp).getTime() : 0;
          let normalizedSource = normalizeCache.get(source);
          if (normalizedSource === undefined) {
            normalizedSource = normalizeUsageSourceId(source);
            normalizeCache.set(source, normalizedSource);
          }
          const sourceInfo = resolveSourceDisplay(normalizedSource, detail.auth_index, sourceInfoMap, authFileMap);
          const providerType = sourceInfo.type || providerTypeMap[source] || '--';
          const resolvedName = sourceInfo.displayName && sourceInfo.displayName !== normalizedSource
            ? sourceInfo.displayName
            : null;
          const displayName = resolvedName ? `${resolvedName} (${masked})` : masked;
          const providerBaseUrl = normalizeOpenAIProviderBaseUrl(sourceInfo.baseUrl);
          const rawInputTokens = detail.tokens.input_tokens || 0;
          const cacheReadTokens = extractMonitorHitTokens(detail.tokens);
          const reasoningEffort = detail.reasoning_effort?.trim() || '';
          const requestType = detail.request_type?.trim().toLowerCase() || '';
          const firstTokenMs = normalizeFirstTokenMs(detail.first_token_ms);
          const latencyMs = typeof detail.latency_ms === 'number' ? detail.latency_ms : null;
          const userAgent = normalizeUserAgentDisplay(detail.user_agent);
          // 单条消费金额沿用监控页与 usage 页统一的模型价格口径；
          // 已定价模型显示精确金额，未定价模型保留为短横线，避免把缺少价格误读成零消费。
          const cost = modelPrices[modelName]
            ? calculateCost(
              {
                ...detail,
                auth_index: Number(detail.auth_index) || 0,
                __modelName: modelName,
              },
              modelPrices,
            )
            : null;
          entries.push({
            id: `${idCounter++}`,
            timestamp: detail.timestamp,
            timestampMs,
            latencyMs,
            apiKey,
            model: modelName,
            reasoningEffort,
            source,
            displayName,
            providerName: resolvedName,
            providerType,
            providerBaseUrl,
            maskedKey: masked,
            failed: detail.failed,
            requestType,
            firstTokenMs,
            inputTokens: calculateMonitorNetInputTokens(rawInputTokens, cacheReadTokens),
            outputTokens: detail.tokens.output_tokens || 0,
            cacheReadTokens,
            hitRate: calculateMonitorHitRate(rawInputTokens, cacheReadTokens),
            outputThroughput: calculateOutputThroughput(
              detail.tokens.output_tokens || 0,
              latencyMs,
              detail.failed,
            ),
            cost,
            // 新版后端会返回 client_ip；旧快照可能仍只有 auth_index，这里保留回退，
            // 避免历史数据在监控中心中直接显示为空。
            clientIp: normalizeRequestClientIp(detail.client_ip) ?? normalizeAuthIndex(detail.auth_index) ?? '',
            userAgent,
          });
        });
      });
    });

    return entries.sort((a, b) => b.timestampMs - a.timestampMs);
  }, [effectiveData, providerMap, providerTypeMap, sourceInfoMap, authFileMap, modelPrices]);

  // 请求状态列展示同渠道同模型最近请求状态，保留连续成功/失败的排障信号。
  const precomputedStats = useMemo(() => {
    const statsMap = new Map<string, PrecomputedStats>();
    const channelModelGroups: Record<string, LogEntry[]> = {};

    logEntries.forEach((entry) => {
      const key = `${entry.source}|||${entry.model}|||${entry.reasoningEffort}`;
      if (!channelModelGroups[key]) {
        channelModelGroups[key] = [];
      }
      channelModelGroups[key].push(entry);
    });

    Object.values(channelModelGroups).forEach((group) => {
      const recentRequests: ChannelModelRequest[] = [];
      group.sort((a, b) => a.timestampMs - b.timestampMs);

      group.forEach((entry) => {
        recentRequests.push({ failed: entry.failed, timestamp: entry.timestampMs });
        if (recentRequests.length > 10) {
          recentRequests.shift();
        }
        statsMap.set(entry.id, { recentRequests: [...recentRequests] });
      });
    });

    return statsMap;
  }, [logEntries]);

  const { apis, models, providerTypes } = useMemo(() => {
    const apiSet = new Set<string>();
    const modelSet = new Set<string>();
    const providerTypeSet = new Set<string>();

    logEntries.forEach((entry) => {
      apiSet.add(entry.apiKey);
      modelSet.add(entry.model);
      if (entry.providerType && entry.providerType !== '--') {
        providerTypeSet.add(entry.providerType);
      }
    });

    return {
      apis: Array.from(apiSet).sort(),
      models: Array.from(modelSet).sort(),
      providerTypes: Array.from(providerTypeSet).sort(),
    };
  }, [logEntries]);

  const filteredEntries = useMemo(() => {
    return logEntries.filter((entry) => {
      if (filterApi && entry.apiKey !== filterApi) return false;
      if (filterModel && entry.model !== filterModel) return false;
      if (!isChannelMatchedBySearch(entry, sourceSearchQuery)) return false;
      if (filterStatus === 'success' && entry.failed) return false;
      if (filterStatus === 'failed' && !entry.failed) return false;
      if (filterProviderType && entry.providerType !== filterProviderType) return false;
      return true;
    });
  }, [logEntries, filterApi, filterModel, sourceSearchQuery, filterStatus, filterProviderType]);

  const visibleEntries = useMemo(() => {
    return filteredEntries.slice(0, MAX_VISIBLE_LOGS);
  }, [filteredEntries]);

  const formatNumber = (num: number) => {
    return num.toLocaleString('zh-CN');
  };

  const formatHitRate = (hitRate: number) => `${(hitRate * 100).toFixed(1)}%`;

  // 响应时间优先保留毫秒级精度，超过 1 秒后自动切换为秒，便于快速识别慢请求。
  // 输出速率严格依赖 latency_ms，因此这里不额外猜测缺失耗时的情况。
  const formatLatency = (latencyMs: number | null) => {
    if (latencyMs === null || Number.isNaN(latencyMs)) {
      return '-';
    }
    if (latencyMs < 1000) {
      return `${latencyMs} ms`;
    }
    const seconds = latencyMs / 1000;
    const precision = seconds >= 10 ? 1 : 2;
    return `${Number(seconds.toFixed(precision))} s`;
  };

  const getStats = (entry: LogEntry): PrecomputedStats => {
    return precomputedStats.get(entry.id) || { recentRequests: [] };
  };

  const renderRow = (entry: LogEntry) => {
    const stats = getStats(entry);
    const requestIpDisplay = entry.clientIp || '-';
    const requestTypeDisplay = formatRequestType(entry.requestType, t);
    const firstTokenDisplay = formatLatency(entry.firstTokenMs);
    const userAgentDisplay = entry.userAgent || '-';
    const channelTitle = entry.providerBaseUrl || entry.source;
    const modelDisplay = formatModelWithEffort(entry.model, entry.reasoningEffort);
    const tokenItems = [
      {
        key: TOKEN_CELL_ITEMS[0].key,
        icon: TOKEN_CELL_ITEMS[0].icon,
        label: t('monitor.logs.header_input'),
        value: formatNumber(entry.inputTokens),
        className: TOKEN_CELL_ITEMS[0].className,
        iconClassName: TOKEN_CELL_ITEMS[0].iconClassName,
      },
      {
        key: TOKEN_CELL_ITEMS[1].key,
        icon: TOKEN_CELL_ITEMS[1].icon,
        label: t('monitor.logs.header_output'),
        value: formatNumber(entry.outputTokens),
        className: TOKEN_CELL_ITEMS[1].className,
        iconClassName: TOKEN_CELL_ITEMS[1].iconClassName,
      },
      {
        key: TOKEN_CELL_ITEMS[2].key,
        icon: TOKEN_CELL_ITEMS[2].icon,
        label: t('monitor.logs.header_cache_read'),
        value: formatNumber(entry.cacheReadTokens),
        className: TOKEN_CELL_ITEMS[2].className,
        iconClassName: TOKEN_CELL_ITEMS[2].iconClassName,
      },
    ];
    const hitRateDisplay = `(${formatHitRate(entry.hitRate)})`;
    const tokenTitle = [
      ...tokenItems.map((item) => `${item.icon} ${item.label} ${item.value}`),
      `${t('monitor.logs.header_cache_hit_rate')} ${hitRateDisplay}`,
    ].join(' / ');

    return (
      <>
        <td title={entry.apiKey}>
          {maskSecret(entry.apiKey)}
        </td>
        <td title={requestIpDisplay}>
          {requestIpDisplay}
        </td>
        <td title={modelDisplay}>
          <span className={getModelTextClassName(entry.failed)}>
            {modelDisplay}
          </span>
        </td>
        <td>
          <div className={styles.statusBars}>
            {stats.recentRequests.map((req, idx) => (
              <div
                key={idx}
                className={`${styles.statusBar} ${req.failed ? styles.failure : styles.success}`}
              />
            ))}
          </div>
        </td>
        <td title={requestTypeDisplay}>
          {requestTypeDisplay}
        </td>
        <td title={entry.outputThroughput === null ? '-' : `${entry.outputTokens} / ${entry.latencyMs} ms`}>
          {formatOutputThroughput(entry.outputThroughput, i18n.language)}
        </td>
        <td title={tokenTitle}>
          <div className={styles.tokenSummary}>
            {tokenItems.map((item) => (
              <span key={item.key} className={`${styles.tokenMetric} ${item.className}`}>
                <span className={`${styles.tokenMetricIcon} ${item.iconClassName}`} aria-hidden="true">{item.icon}</span>
                <span>{item.value}</span>
              </span>
            ))}
            <span className={styles.tokenMetricHitRate}>{hitRateDisplay}</span>
          </div>
        </td>
        <td title={formatRequestCost(entry.cost)}>
          {formatRequestCost(entry.cost)}
        </td>
        <td title={entry.firstTokenMs === null ? '-' : `${entry.firstTokenMs} ms`}>
          {firstTokenDisplay}
        </td>
        <td title={entry.latencyMs === null ? '-' : `${entry.latencyMs} ms`}>
          {formatLatency(entry.latencyMs)}
        </td>
        <td>{entry.providerType}</td>
        <td title={channelTitle}>
          {entry.providerName ? (
            <>
              {entry.providerBaseUrl ? (
                <a
                  href={entry.providerBaseUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={`${styles.channelName} ${styles.channelLink}`}
                >
                  {entry.providerName}
                </a>
              ) : (
                <span className={styles.channelName}>{entry.providerName}</span>
              )}
              <span className={styles.channelSecret}> ({entry.maskedKey})</span>
            </>
          ) : entry.providerBaseUrl ? (
            <a
              href={entry.providerBaseUrl}
              target="_blank"
              rel="noreferrer"
              className={styles.channelLink}
            >
              {entry.maskedKey}
            </a>
          ) : (
            entry.maskedKey
          )}
        </td>
        <td>{formatTimestamp(entry.timestamp)}</td>
        <td title={userAgentDisplay}>
          {userAgentDisplay}
        </td>
      </>
    );
  };

  return (
    <>
      <Card
        title={t('monitor.logs.title')}
        subtitle={
          <span>
            {t('monitor.logs.total_count', { count: visibleEntries.length })}
            <span style={{ color: 'var(--text-tertiary)' }}> · {t('monitor.logs.scroll_hint')}</span>
          </span>
        }
      >
        <div className={styles.logFilters}>
          <select
            className={styles.logSelect}
            value={filterApi}
            onChange={(e) => setFilterApi(e.target.value)}
          >
            <option value="">{t('monitor.logs.all_apis')}</option>
            {apis.map((api) => (
              <option key={api} value={api}>
                {maskSecret(api)}
              </option>
            ))}
          </select>
          <select
            className={styles.logSelect}
            value={filterProviderType}
            onChange={(e) => setFilterProviderType(e.target.value)}
          >
            <option value="">{t('monitor.logs.all_provider_types')}</option>
            {providerTypes.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          <select
            className={styles.logSelect}
            value={filterModel}
            onChange={(e) => setFilterModel(e.target.value)}
          >
            <option value="">{t('monitor.logs.all_models')}</option>
            {models.map((model) => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>
          <input
            type="search"
            className={styles.logSearchInput}
            value={sourceSearchQuery}
            onChange={(e) => setSourceSearchQuery(e.target.value)}
            placeholder={t('monitor.logs.source_search_placeholder')}
            aria-label={t('monitor.logs.source_search_label')}
          />
          <select
            className={styles.logSelect}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as '' | 'success' | 'failed')}
          >
            <option value="">{t('monitor.logs.all_status')}</option>
            <option value="success">{t('monitor.logs.success')}</option>
            <option value="failed">{t('monitor.logs.failed')}</option>
          </select>

          <span className={styles.logLastUpdate}>
            {getCountdownText()}
          </span>

          <select
            className={styles.logSelect}
            value={autoRefresh}
            onChange={(e) => setAutoRefresh(Number(e.target.value))}
          >
            <option value="0">{t('monitor.logs.manual_refresh')}</option>
            <option value="5">{t('monitor.logs.refresh_5s')}</option>
            <option value="10">{t('monitor.logs.refresh_10s')}</option>
            <option value="15">{t('monitor.logs.refresh_15s')}</option>
            <option value="30">{t('monitor.logs.refresh_30s')}</option>
            <option value="60">{t('monitor.logs.refresh_60s')}</option>
          </select>
        </div>

        <div className={styles.tableWrapper}>
          {showLoading ? (
            <div className={styles.emptyState}>{t('common.loading')}</div>
          ) : visibleEntries.length === 0 ? (
            <div className={styles.emptyState}>{t('monitor.no_data')}</div>
          ) : (
            <table className={`${styles.table} ${styles.virtualTable}`}>
              <thead>
                <tr>
                  <th>{t('monitor.logs.header_api')}</th>
                  <th>{t('monitor.logs.header_auth')}</th>
                  <th>{t('monitor.logs.header_model')}</th>
                  <th>{t('monitor.logs.header_status')}</th>
                  <th>{t('monitor.logs.header_request_type')}</th>
                  <th>{t('monitor.logs.header_output_throughput')}</th>
                  <th>{t('monitor.logs.header_tokens')}</th>
                  <th>{t('monitor.logs.header_cost')}</th>
                  <th>{t('monitor.logs.header_first_token')}</th>
                  <th>{t('monitor.logs.header_latency')}</th>
                  <th>{t('monitor.logs.header_provider_type')}</th>
                  <th>{t('monitor.logs.header_source')}</th>
                  <th>{t('monitor.logs.header_time')}</th>
                  <th>{t('monitor.logs.header_user_agent')}</th>
                </tr>
              </thead>
              <tbody>
                {visibleEntries.map((entry) => (
                  <tr key={entry.id}>
                    {renderRow(entry)}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {visibleEntries.length > 0 && (
          <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8 }}>
            {t('monitor.logs.total_count', { count: visibleEntries.length })}
          </div>
        )}
      </Card>
    </>
  );
}
