import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChartOptions, TooltipItem } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import type { UsageData } from '@/pages/MonitorPage';
import { buildModelDistributionMetrics, formatOutputThroughput } from '@/utils/monitorThroughput';
import { formatPresetTimeRangeLabel, type PresetTimeRange } from '@/utils/monitor';
import styles from '@/pages/MonitorPage.module.scss';

interface ModelDistributionChartProps {
  data: UsageData | null;
  loading: boolean;
  isDark: boolean;
  timeRange: PresetTimeRange;
}

// 颜色调色板
const COLORS = [
  '#3b82f6', // 蓝色
  '#22c55e', // 绿色
  '#f97316', // 橙色
  '#8b5cf6', // 紫色
  '#ec4899', // 粉色
  '#06b6d4', // 青色
  '#eab308', // 黄色
  '#ef4444', // 红色
  '#14b8a6', // 青绿
  '#6366f1', // 靛蓝
];

type ViewMode = 'request' | 'token' | 'throughput';

/**
 * 按当前视图口径排序模型列表，确保 Top 10 与当前切换项严格一致。
 */
function sortModelMetrics(
  left: ReturnType<typeof buildModelDistributionMetrics>[number],
  right: ReturnType<typeof buildModelDistributionMetrics>[number],
  viewMode: ViewMode,
): number {
  if (viewMode === 'request') {
    return right.requests - left.requests;
  }
  if (viewMode === 'token') {
    return right.tokens - left.tokens;
  }

  return (right.outputThroughput ?? -1) - (left.outputThroughput ?? -1);
}

/**
 * 解析卡片副标题文案 key，避免 JSX 里堆叠三元表达式。
 */
function resolveSubtitleKey(viewMode: ViewMode): string {
  if (viewMode === 'request') return 'monitor.distribution.by_requests';
  if (viewMode === 'token') return 'monitor.distribution.by_tokens';
  return 'monitor.distribution.by_output_throughput';
}

/**
 * 非速率模式下圆环中心只展示占比语义，因此这里单独抽出文案映射。
 */
function resolveCenterLabelKey(viewMode: ViewMode): string {
  if (viewMode === 'request') return 'monitor.distribution.request_share';
  return 'monitor.distribution.token_share';
}

/**
 * 请求数与 Token 数继续沿用紧凑数字展示，避免 Top 10 图例过宽。
 */
function formatCompactValue(value: number): string {
  if (value >= 1000000) {
    return (value / 1000000).toFixed(1) + 'M';
  }
  if (value >= 1000) {
    return (value / 1000).toFixed(1) + 'K';
  }
  return value.toString();
}

export function ModelDistributionChart({ data, loading, isDark, timeRange }: ModelDistributionChartProps) {
  const { t, i18n } = useTranslation();
  // 监控中心更关注实际消耗，默认按 Token 视角展示模型分布
  const [viewMode, setViewMode] = useState<ViewMode>('token');

  const timeRangeLabel = formatPresetTimeRangeLabel(timeRange, t);

  // 统一聚合三种口径，确保切换视图时使用同一份模型统计结果。
  const distributionData = useMemo(() => {
    const metrics = buildModelDistributionMetrics(data)
      .sort((left, right) => sortModelMetrics(left, right, viewMode))
      .slice(0, 10);
    return metrics;
  }, [data, viewMode]);

  const total = useMemo(() => {
    return distributionData.reduce((sum, item) => {
      if (viewMode === 'request') {
        return sum + item.requests;
      }
      return sum + item.tokens;
    }, 0);
  }, [distributionData, viewMode]);

  const chartData = useMemo(() => {
    if (viewMode === 'throughput') {
      return null;
    }

    return {
      labels: distributionData.map((item) => item.name),
      datasets: [
        {
          data: distributionData.map((item) =>
            viewMode === 'request' ? item.requests : item.tokens
          ),
          backgroundColor: COLORS.slice(0, distributionData.length),
          borderColor: isDark ? '#1f2937' : '#ffffff',
          borderWidth: 2,
        },
      ],
    };
  }, [distributionData, viewMode, isDark]);

  const chartOptions = useMemo<ChartOptions<'doughnut'> | null>(() => {
    if (viewMode === 'throughput') {
      return null;
    }

    return {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: isDark ? '#374151' : '#ffffff',
          titleColor: isDark ? '#f3f4f6' : '#111827',
          bodyColor: isDark ? '#d1d5db' : '#4b5563',
          borderColor: isDark ? '#4b5563' : '#e5e7eb',
          borderWidth: 1,
          padding: 12,
          callbacks: {
            label: (context: TooltipItem<'doughnut'>) => {
              const value = typeof context.raw === 'number' ? context.raw : 0;
              const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
              if (viewMode === 'request') {
                return `${value.toLocaleString()} ${t('monitor.requests')} (${percentage}%)`;
              }
              return `${value.toLocaleString()} tokens (${percentage}%)`;
            },
          },
        },
      },
    };
  }, [isDark, total, viewMode, t]);

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <div>
          <h3 className={styles.chartTitle}>{t('monitor.distribution.title')}</h3>
          <p className={styles.chartSubtitle}>
            {timeRangeLabel} · {t(resolveSubtitleKey(viewMode))}
            {' · Top 10'}
          </p>
        </div>
        <div className={styles.chartControls}>
          <button
            className={`${styles.chartControlBtn} ${viewMode === 'request' ? styles.active : ''}`}
            onClick={() => setViewMode('request')}
          >
            {t('monitor.distribution.requests')}
          </button>
          <button
            className={`${styles.chartControlBtn} ${viewMode === 'token' ? styles.active : ''}`}
            onClick={() => setViewMode('token')}
          >
            {t('monitor.distribution.tokens')}
          </button>
          <button
            className={`${styles.chartControlBtn} ${viewMode === 'throughput' ? styles.active : ''}`}
            onClick={() => setViewMode('throughput')}
          >
            {t('monitor.distribution.output_throughput')}
          </button>
        </div>
      </div>

      {loading || distributionData.length === 0 ? (
        <div className={styles.chartContent}>
          <div className={styles.chartEmpty}>
            {loading ? t('common.loading') : t('monitor.no_data')}
          </div>
        </div>
      ) : viewMode === 'throughput' ? (
        <div className={styles.chartContent}>
          <div className={styles.rankingList}>
            {distributionData.map((item, index) => (
              <div key={item.name} className={styles.rankingItem}>
                <div className={styles.rankingMain}>
                  <span className={styles.rankingIndex}>{index + 1}</span>
                  <span className={styles.rankingName} title={item.name}>
                    {item.name}
                  </span>
                </div>
                <div className={styles.rankingMeta}>
                  <span className={styles.rankingValue}>
                    {formatOutputThroughput(item.outputThroughput, i18n.language)}
                  </span>
                  <span className={styles.rankingSubValue}>
                    {t('monitor.distribution.valid_samples', { count: item.throughputSampleCount })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className={styles.distributionContent}>
          <div className={styles.donutWrapper}>
            <Doughnut data={chartData!} options={chartOptions!} />
            <div className={styles.donutCenter}>
              <div className={styles.donutLabel}>
                {t(resolveCenterLabelKey(viewMode))}
              </div>
            </div>
          </div>
          <div className={styles.legendList}>
            {distributionData.map((item, index) => {
              const value = viewMode === 'request' ? item.requests : item.tokens;
              const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
              return (
                <div key={item.name} className={styles.legendItem}>
                  <span
                    className={styles.legendDot}
                    style={{ backgroundColor: COLORS[index] }}
                  />
                  <span className={styles.legendName} title={item.name}>
                    {item.name}
                  </span>
                  <span className={styles.legendValue}>
                    {formatCompactValue(value)} ({percentage}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
