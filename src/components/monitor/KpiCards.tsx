import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { UsageData } from '@/pages/MonitorPage';
import { formatPresetTimeRangeLabel, type PresetTimeRange } from '@/utils/monitor';
import {
  calculateMonitorHitRate,
  calculateMonitorNetInputTokens,
  extractMonitorHitTokens,
} from '@/utils/monitorTokenStats';
import { formatUsd, loadModelPrices, summarizeUsagePricing } from '@/utils/usage';
import styles from '@/pages/MonitorPage.module.scss';

interface KpiCardsProps {
  data: UsageData | null;
  loading: boolean;
  timeRange: PresetTimeRange;
  authFileAvailable: number | null;
  authFileTotal: number | null;
}

// 格式化数字
function formatNumber(num: number): string {
  if (num >= 1000000000) {
    return (num / 1000000000).toFixed(2) + 'B';
  }
  if (num >= 1000000) {
    return (num / 1000000).toFixed(2) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(2) + 'K';
  }
  return num.toLocaleString();
}

export function KpiCards({
  data,
  loading,
  timeRange,
  authFileAvailable,
  authFileTotal,
}: KpiCardsProps) {
  const { t } = useTranslation();
  const modelPrices = useMemo(() => loadModelPrices(), []);

  // 计算统计数据
  const stats = useMemo(() => {
    if (!data?.apis) {
      return {
        totalRequests: 0,
        successRequests: 0,
        failedRequests: 0,
        successRate: 0,
        totalTokens: 0,
        inputTokens: 0,
        hitTokens: 0,
        hitRate: 0,
        outputTokens: 0,
        reasoningTokens: 0,
        cachedTokens: 0,
        avgTpm: 0,
        avgRpm: 0,
        avgRpd: 0,
      };
    }

    let totalRequests = 0;
    let successRequests = 0;
    let failedRequests = 0;
    let totalTokens = 0;
    let rawInputTokens = 0;
    let inputTokens = 0;
    let hitTokens = 0;
    let outputTokens = 0;
    let reasoningTokens = 0;
    let cachedTokens = 0;

    // 追踪时间戳范围用于计算 TPM/RPM
    let minTime = Infinity;
    let maxTime = -Infinity;

    Object.values(data.apis).forEach((apiData) => {
      Object.values(apiData.models).forEach((modelData) => {
        modelData.details.forEach((detail) => {
          totalRequests++;
          if (detail.failed) {
            failedRequests++;
          } else {
            successRequests++;
          }

          totalTokens += detail.tokens.total_tokens || 0;
          const requestRawInputTokens = detail.tokens.input_tokens || 0;
          rawInputTokens += requestRawInputTokens;
          // 监控中心把 usage snapshot 里的 cached/cache tokens 统一展示为“命中 Token”。
          const requestHitTokens = extractMonitorHitTokens(detail.tokens);
          hitTokens += requestHitTokens;
          inputTokens += calculateMonitorNetInputTokens(requestRawInputTokens, requestHitTokens);
          outputTokens += detail.tokens.output_tokens || 0;
          reasoningTokens += detail.tokens.reasoning_tokens || 0;
          cachedTokens += detail.tokens.cached_tokens || 0;

          const ts = new Date(detail.timestamp).getTime();
          if (ts < minTime) minTime = ts;
          if (ts > maxTime) maxTime = ts;
        });
      });
    });

    const successRate = totalRequests > 0 ? (successRequests / totalRequests) * 100 : 0;
    const hitRate = calculateMonitorHitRate(rawInputTokens, hitTokens) * 100;

    // 计算 TPM 和 RPM（基于实际时间跨度）
    let avgTpm = 0;
    let avgRpm = 0;
    let avgRpd = 0;

    if (minTime !== Infinity) {
      const timeSpanMinutes = Math.max((maxTime - minTime) / (1000 * 60), 1);
      const timeSpanDays = Math.max(timeSpanMinutes / (60 * 24), 1);

      avgTpm = Math.round(totalTokens / timeSpanMinutes);
      avgRpm = Math.round((totalRequests / timeSpanMinutes) * 10) / 10;
      avgRpd = Math.round(totalRequests / timeSpanDays);
    }

    return {
      totalRequests,
      successRequests,
      failedRequests,
      successRate,
      totalTokens,
      inputTokens,
      hitTokens,
      hitRate,
      outputTokens,
      reasoningTokens,
      cachedTokens,
      avgTpm,
      avgRpm,
      avgRpd,
    };
  }, [data]);

  // 消费金额与使用统计页共用同一份本地模型价格，避免两边口径不一致。
  const pricingSummary = useMemo(
    () => summarizeUsagePricing(data, modelPrices),
    [data, modelPrices]
  );

  const timeRangeLabel = formatPresetTimeRangeLabel(timeRange, t);

  return (
    <div className={styles.kpiGrid}>
      {/* 号池总数 */}
      <div className={styles.kpiCard}>
        <div className={styles.kpiTitle}>
          <span className={styles.kpiLabel}>{t('monitor.auth_files_total')}</span>
          <span className={styles.kpiTag}>{t('nav.auth_files')}</span>
        </div>
        <div className={styles.kpiValue}>
          {authFileAvailable === null || authFileTotal === null
            ? '--'
            : `${authFileAvailable.toLocaleString()}/${authFileTotal.toLocaleString()}`}
        </div>
      </div>

      {/* 请求数 */}
      <div className={styles.kpiCard}>
        <div className={styles.kpiTitle}>
          <span className={styles.kpiLabel}>{t('monitor.kpi.requests')}</span>
          <span className={styles.kpiTag}>{timeRangeLabel}</span>
        </div>
        <div className={styles.kpiValue}>{loading ? '--' : formatNumber(stats.totalRequests)}</div>
        <div className={styles.kpiMeta}>
          <span className={styles.kpiSuccess}>
            {t('monitor.kpi.success')}: {loading ? '--' : stats.successRequests.toLocaleString()}
          </span>
          <span className={styles.kpiFailure}>
            {t('monitor.kpi.failed')}: {loading ? '--' : stats.failedRequests.toLocaleString()}
          </span>
          <span>
            {t('monitor.kpi.rate')}: {loading ? '--' : stats.successRate.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Tokens */}
      <div className={`${styles.kpiCard} ${styles.green}`}>
        <div className={styles.kpiTitle}>
          <span className={styles.kpiLabel}>{t('monitor.kpi.tokens')}</span>
          <span className={styles.kpiTag}>{timeRangeLabel}</span>
        </div>
        <div className={styles.kpiValue}>{loading ? '--' : formatNumber(stats.totalTokens)}</div>
        <div className={styles.kpiMeta}>
          <span>
            {t('monitor.kpi.input')}: {loading ? '--' : formatNumber(stats.inputTokens)}
          </span>
          <span>
            {t('monitor.kpi.hit')}:{' '}
            {loading ? '--' : `${formatNumber(stats.hitTokens)} (${stats.hitRate.toFixed(1)}%)`}
          </span>
          <span>
            {t('monitor.kpi.output')}: {loading ? '--' : formatNumber(stats.outputTokens)}
          </span>
        </div>
      </div>

      {/* 平均速率 */}
      <div className={`${styles.kpiCard} ${styles.purple}`}>
        <div className={styles.kpiTitle}>
          <span className={styles.kpiLabel}>{t('monitor.kpi.avg_rate')}</span>
          <span className={styles.kpiTag}>{timeRangeLabel}</span>
        </div>
        <div className={styles.kpiSplitValue}>
          <div className={styles.kpiSplitItem}>
            <span className={styles.kpiSplitLabel}>{t('monitor.kpi.avg_tpm')}</span>
            <span className={styles.kpiSplitNumber}>
              {loading ? '--' : formatNumber(stats.avgTpm)}
            </span>
          </div>
          <div className={styles.kpiSplitItem}>
            <span className={styles.kpiSplitLabel}>{t('monitor.kpi.avg_rpm')}</span>
            <span className={styles.kpiSplitNumber}>
              {loading ? '--' : stats.avgRpm.toFixed(1)}
            </span>
          </div>
        </div>
        <div className={styles.kpiMeta}>
          <span>{t('monitor.kpi.avg_rate_hint')}</span>
        </div>
      </div>

      {/* 消费金额 */}
      <div className={`${styles.kpiCard} ${styles.orange}`}>
        <div className={styles.kpiTitle}>
          <span className={styles.kpiLabel}>{t('monitor.kpi.cost')}</span>
          <span className={styles.kpiTag}>{timeRangeLabel}</span>
        </div>
        <div className={styles.kpiValue}>
          {loading
            ? '--'
            : pricingSummary.pricedRequestCount > 0
              ? formatUsd(pricingSummary.totalCost)
              : '--'}
        </div>
        <div className={styles.kpiMeta}>
          {loading ? (
            <span>--</span>
          ) : pricingSummary.pricedRequestCount > 0 ? (
            <>
              <span>
                {t('monitor.kpi.priced_requests')}:{' '}
                {pricingSummary.pricedRequestCount.toLocaleString()}
              </span>
              {pricingSummary.unpricedRequestCount > 0 && (
                <span>{t('usage_stats.cost_partial_notice')}</span>
              )}
            </>
          ) : pricingSummary.unpricedRequestCount > 0 ? (
            <span>{t('usage_stats.cost_need_price')}</span>
          ) : (
            <span>{t('usage_stats.cost_need_usage')}</span>
          )}
        </div>
      </div>

      {/* 日均 RPD */}
      <div className={`${styles.kpiCard} ${styles.cyan}`}>
        <div className={styles.kpiTitle}>
          <span className={styles.kpiLabel}>{t('monitor.kpi.avg_rpd')}</span>
          <span className={styles.kpiTag}>{timeRangeLabel}</span>
        </div>
        <div className={styles.kpiValue}>{loading ? '--' : formatNumber(stats.avgRpd)}</div>
        <div className={styles.kpiMeta}>
          <span>{t('monitor.kpi.requests_per_day')}</span>
        </div>
      </div>
    </div>
  );
}
