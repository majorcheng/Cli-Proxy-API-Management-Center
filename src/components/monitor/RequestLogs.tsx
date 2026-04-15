import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { usageApi, authFilesApi } from '@/services/api';
import { normalizeUsageSourceId, normalizeAuthIndex } from '@/utils/usage';
import { normalizeRequestClientIp } from '@/utils/requestLogClientIp';
import { calculateOutputThroughput, formatOutputThroughput } from '@/utils/monitorThroughput';
import { extractMonitorHitTokens, calculateMonitorHitRate } from '@/utils/monitorTokenStats';
import { normalizeOpenAIProviderBaseUrl, resolveSourceDisplay } from '@/utils/sourceResolver';
import type { SourceInfo, CredentialInfo } from '@/types/sourceInfo';
import {
  maskSecret,
  formatProviderDisplay,
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
  inputTokens: number;
  hitTokens: number;
  hitRate: number;
  outputTokens: number;
  outputThroughput: number | null;
  totalTokens: number;
  clientIp: string;
}

interface ChannelModelRequest {
  failed: boolean;
  timestamp: number;
}

// 预计算的统计数据缓存
interface PrecomputedStats {
  recentRequests: ChannelModelRequest[];
  totalCount: number;
}

// 请求日志仅展示最近 36 条，避免页面出现双层纵向滚动
const MAX_VISIBLE_LOGS = 36;

export function RequestLogs({ data, loading: parentLoading, timeRange, providerMap, providerTypeMap, sourceInfoMap, authFileMap: propAuthFileMap, apiFilter }: RequestLogsProps) {
  const { t, i18n } = useTranslation();
  const [filterApi, setFilterApi] = useState('');
  const [filterModel, setFilterModel] = useState('');
  const [filterSource, setFilterSource] = useState('');
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
          const inputTokens = detail.tokens.input_tokens || 0;
          const hitTokens = extractMonitorHitTokens(detail.tokens);
          const reasoningEffort = detail.reasoning_effort?.trim() || '';
          const latencyMs = typeof detail.latency_ms === 'number' ? detail.latency_ms : null;
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
            inputTokens,
            hitTokens,
            hitRate: calculateMonitorHitRate(inputTokens, hitTokens),
            outputTokens: detail.tokens.output_tokens || 0,
            outputThroughput: calculateOutputThroughput(
              detail.tokens.output_tokens || 0,
              latencyMs,
              detail.failed,
            ),
            totalTokens: detail.tokens.total_tokens || 0,
            // 新版后端会返回 client_ip；旧快照可能仍只有 auth_index，这里保留回退，
            // 避免历史数据在监控中心中直接显示为空。
            clientIp: normalizeRequestClientIp(detail.client_ip) ?? normalizeAuthIndex(detail.auth_index) ?? '',
          });
        });
      });
    });

    return entries.sort((a, b) => b.timestampMs - a.timestampMs);
  }, [effectiveData, providerMap, providerTypeMap, sourceInfoMap, authFileMap]);

  // 预计算每个“渠道 + 模型”分组的累计请求数与最近请求状态，
  // 请求日志表只保留这两个稳定指标，避免把“成功率”这种聚合指标塞回单行详情里误导阅读。
  const precomputedStats = useMemo(() => {
    const statsMap = new Map<string, PrecomputedStats>();
    const channelModelGroups: Record<string, { entry: LogEntry; index: number }[]> = {};

    logEntries.forEach((entry, index) => {
      const key = `${entry.source}|||${entry.model}`;
      if (!channelModelGroups[key]) {
        channelModelGroups[key] = [];
      }
      channelModelGroups[key].push({ entry, index });
    });

    Object.values(channelModelGroups).forEach((group) => {
      group.sort((a, b) => a.entry.timestampMs - b.entry.timestampMs);
    });

    Object.entries(channelModelGroups).forEach(([, group]) => {
      let totalCount = 0;
      const recentRequests: ChannelModelRequest[] = [];

      group.forEach(({ entry }) => {
        totalCount++;
        recentRequests.push({ failed: entry.failed, timestamp: entry.timestampMs });
        if (recentRequests.length > 10) {
          recentRequests.shift();
        }

        statsMap.set(entry.id, {
          recentRequests: [...recentRequests],
          totalCount,
        });
      });
    });

    return statsMap;
  }, [logEntries]);

  const { apis, models, sources, providerTypes } = useMemo(() => {
    const apiSet = new Set<string>();
    const modelSet = new Set<string>();
    const sourceSet = new Set<string>();
    const providerTypeSet = new Set<string>();

    logEntries.forEach((entry) => {
      apiSet.add(entry.apiKey);
      modelSet.add(entry.model);
      sourceSet.add(entry.source);
      if (entry.providerType && entry.providerType !== '--') {
        providerTypeSet.add(entry.providerType);
      }
    });

    return {
      apis: Array.from(apiSet).sort(),
      models: Array.from(modelSet).sort(),
      sources: Array.from(sourceSet).sort(),
      providerTypes: Array.from(providerTypeSet).sort(),
    };
  }, [logEntries]);

  const filteredEntries = useMemo(() => {
    return logEntries.filter((entry) => {
      if (filterApi && entry.apiKey !== filterApi) return false;
      if (filterModel && entry.model !== filterModel) return false;
      if (filterSource && entry.source !== filterSource) return false;
      if (filterStatus === 'success' && entry.failed) return false;
      if (filterStatus === 'failed' && !entry.failed) return false;
      if (filterProviderType && entry.providerType !== filterProviderType) return false;
      return true;
    });
  }, [logEntries, filterApi, filterModel, filterSource, filterStatus, filterProviderType]);

  const visibleEntries = useMemo(() => {
    return filteredEntries.slice(0, MAX_VISIBLE_LOGS);
  }, [filteredEntries]);

  const formatNumber = (num: number) => {
    return num.toLocaleString('zh-CN');
  };

  const formatHitDisplay = (hitTokens: number, hitRate: number) => {
    return `${formatNumber(hitTokens)} (${(hitRate * 100).toFixed(1)}%)`;
  };

  const formatReasoningEffortDisplay = (reasoningEffort: string) => {
    return reasoningEffort || '-';
  };

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
    return precomputedStats.get(entry.id) || {
      recentRequests: [],
      totalCount: 0,
    };
  };

  const renderRow = (entry: LogEntry) => {
    const stats = getStats(entry);
    const requestIpDisplay = entry.clientIp || '-';
    const channelTitle = entry.providerBaseUrl || entry.source;

    return (
      <>
        <td title={entry.model}>
          {entry.model}
        </td>
        <td title={formatReasoningEffortDisplay(entry.reasoningEffort)}>
          {formatReasoningEffortDisplay(entry.reasoningEffort)}
        </td>
        <td>
          <span className={`${styles.statusPill} ${entry.failed ? styles.failed : styles.success}`}>
            {entry.failed ? t('monitor.logs.failed') : t('monitor.logs.success')}
          </span>
        </td>
        <td title={entry.latencyMs === null ? '-' : `${entry.latencyMs} ms`}>
          {formatLatency(entry.latencyMs)}
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
        <td title={requestIpDisplay}>
          {requestIpDisplay}
        </td>
        <td title={entry.apiKey}>
          {maskSecret(entry.apiKey)}
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
        <td title={entry.outputThroughput === null ? '-' : `${entry.outputTokens} / ${entry.latencyMs} ms`}>
          {formatOutputThroughput(entry.outputThroughput, i18n.language)}
        </td>
        <td>{formatNumber(stats.totalCount)}</td>
        <td>{formatNumber(entry.inputTokens)}</td>
        <td title={formatHitDisplay(entry.hitTokens, entry.hitRate)}>
          {formatHitDisplay(entry.hitTokens, entry.hitRate)}
        </td>
        <td>{formatNumber(entry.outputTokens)}</td>
        <td>{formatNumber(entry.totalTokens)}</td>
        <td>{formatTimestamp(entry.timestamp)}</td>
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
          <select
            className={styles.logSelect}
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
          >
            <option value="">{t('monitor.logs.all_sources')}</option>
            {sources.map((source) => (
              <option key={source} value={source}>
                {formatProviderDisplay(source, providerMap)}
              </option>
            ))}
          </select>
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
                  <th>{t('monitor.logs.header_model')}</th>
                  <th>{t('monitor.logs.header_reasoning_effort')}</th>
                  <th>{t('monitor.logs.header_status')}</th>
                  <th>{t('monitor.logs.header_latency')}</th>
                  <th>{t('monitor.logs.header_recent')}</th>
                  <th>{t('monitor.logs.header_auth')}</th>
                  <th>{t('monitor.logs.header_api')}</th>
                  <th>{t('monitor.logs.header_request_type')}</th>
                  <th>{t('monitor.logs.header_source')}</th>
                  <th>{t('monitor.logs.header_output_throughput')}</th>
                  <th>{t('monitor.logs.header_count')}</th>
                  <th>{t('monitor.logs.header_input')}</th>
                  <th>{t('monitor.logs.header_hit')}</th>
                  <th>{t('monitor.logs.header_output')}</th>
                  <th>{t('monitor.logs.header_total')}</th>
                  <th>{t('monitor.logs.header_time')}</th>
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
