import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Line } from 'react-chartjs-2';
import { IconActivity, IconDiamond, IconDollarSign, IconSatellite } from '@/components/ui/icons';
import {
  formatCompactNumber,
  formatPerMinuteValue,
  formatUsd,
  calculateRecentPerMinuteRates,
  collectUsageDetails,
  summarizePricingFromDetails,
  type ModelPrice,
} from '@/utils/usage';
import { sparklineOptions } from '@/utils/usage/chartConfig';
import type { UsagePayload } from './hooks/useUsageData';
import type { SparklineBundle } from './hooks/useSparklines';
import styles from '@/pages/UsagePage.module.scss';

interface StatCardData {
  key: string;
  label: string;
  icon: ReactNode;
  accent: string;
  accentSoft: string;
  accentBorder: string;
  value: ReactNode;
  meta?: ReactNode;
  trend: ReactNode;
  className?: string;
}

export interface StatCardsProps {
  usage: UsagePayload | null;
  loading: boolean;
  modelPrices: Record<string, ModelPrice>;
  nowMs: number;
  sparklines: {
    requests: SparklineBundle | null;
    tokens: SparklineBundle | null;
    rpm: SparklineBundle | null;
    tpm: SparklineBundle | null;
    cost: SparklineBundle | null;
  };
}

export function StatCards({ usage, loading, modelPrices, nowMs, sparklines }: StatCardsProps) {
  const { t } = useTranslation();

  const hasPrices = Object.keys(modelPrices).length > 0;

  const { tokenBreakdown, rateStats, totalCost, pricedRequestCount, unpricedRequestCount } =
    useMemo(() => {
      const empty = {
        tokenBreakdown: { cachedTokens: 0, reasoningTokens: 0 },
        rateStats: { rpm: 0, tpm: 0, windowMinutes: 30, requestCount: 0, tokenCount: 0 },
        totalCost: 0,
        pricedRequestCount: 0,
        unpricedRequestCount: 0,
      };

      if (!usage) return empty;
      const details = collectUsageDetails(usage);
      if (!details.length) return empty;

      let cachedTokens = 0;
      let reasoningTokens = 0;

      details.forEach((detail) => {
        const tokens = detail.tokens;
        cachedTokens += Math.max(
          typeof tokens.cached_tokens === 'number' ? Math.max(tokens.cached_tokens, 0) : 0,
          typeof tokens.cache_tokens === 'number' ? Math.max(tokens.cache_tokens, 0) : 0
        );
        if (typeof tokens.reasoning_tokens === 'number') {
          reasoningTokens += tokens.reasoning_tokens;
        }
      });

      // 监控页顶部卡牌需要与当前刷新快照对齐，因此这里显式透传 nowMs。
      const rateStats = calculateRecentPerMinuteRates(30, usage, nowMs);
      const pricingSummary = summarizePricingFromDetails(details, modelPrices);

      return {
        tokenBreakdown: { cachedTokens, reasoningTokens },
        rateStats,
        totalCost: pricingSummary.totalCost,
        pricedRequestCount: pricingSummary.pricedRequestCount,
        unpricedRequestCount: pricingSummary.unpricedRequestCount,
      };
    }, [modelPrices, nowMs, usage]);

  const renderSparkline = (trend: SparklineBundle | null) =>
    trend ? (
      <Line className={styles.sparkline} data={trend.data} options={sparklineOptions} />
    ) : (
      <div className={styles.statTrendPlaceholder}></div>
    );

  const statsCards: StatCardData[] = [
    {
      key: 'requests',
      label: t('usage_stats.total_requests'),
      icon: <IconSatellite size={16} />,
      accent: '#3b82f6',
      accentSoft: 'rgba(59, 130, 246, 0.18)',
      accentBorder: 'rgba(59, 130, 246, 0.35)',
      value: loading ? '-' : (usage?.total_requests ?? 0).toLocaleString(),
      meta: (
        <>
          <span className={styles.statMetaItem}>
            <span className={styles.statMetaDot} style={{ backgroundColor: '#10b981' }} />
            {t('usage_stats.success_requests')}: {loading ? '-' : (usage?.success_count ?? 0)}
          </span>
          <span className={styles.statMetaItem}>
            <span className={styles.statMetaDot} style={{ backgroundColor: '#ef4444' }} />
            {t('usage_stats.failed_requests')}: {loading ? '-' : (usage?.failure_count ?? 0)}
          </span>
        </>
      ),
      trend: renderSparkline(sparklines.requests),
    },
    {
      key: 'tokens',
      label: t('usage_stats.total_tokens'),
      icon: <IconDiamond size={16} />,
      accent: '#8b5cf6',
      accentSoft: 'rgba(139, 92, 246, 0.18)',
      accentBorder: 'rgba(139, 92, 246, 0.35)',
      value: loading ? '-' : formatCompactNumber(usage?.total_tokens ?? 0),
      meta: (
        <>
          <span className={styles.statMetaItem}>
            {t('usage_stats.cached_tokens')}:{' '}
            {loading ? '-' : formatCompactNumber(tokenBreakdown.cachedTokens)}
          </span>
          <span className={styles.statMetaItem}>
            {t('usage_stats.reasoning_tokens')}:{' '}
            {loading ? '-' : formatCompactNumber(tokenBreakdown.reasoningTokens)}
          </span>
        </>
      ),
      trend: renderSparkline(sparklines.tokens),
    },
    {
      key: 'rates',
      label: t('usage_stats.rate_30m'),
      icon: <IconActivity size={16} />,
      accent: '#22c55e',
      accentSoft: 'rgba(34, 197, 94, 0.18)',
      accentBorder: 'rgba(34, 197, 94, 0.32)',
      value: (
        <div className={styles.statValueRow}>
          <div className={styles.statValueSmall}>
            <span className={styles.statValueLabel}>{t('usage_stats.rpm_30m')}</span>
            <span className={styles.statValueNum}>
              {loading ? '-' : formatPerMinuteValue(rateStats.rpm)}
            </span>
          </div>
          <div className={styles.statValueSmall}>
            <span className={styles.statValueLabel}>{t('usage_stats.tpm_30m')}</span>
            <span className={styles.statValueNum}>
              {loading ? '-' : formatPerMinuteValue(rateStats.tpm)}
            </span>
          </div>
        </div>
      ),
      meta: (
        <>
          <span className={styles.statMetaItem}>
            {t('usage_stats.total_requests')}:{' '}
            {loading ? '-' : rateStats.requestCount.toLocaleString()}
          </span>
          <span className={styles.statMetaItem}>
            {t('usage_stats.total_tokens')}:{' '}
            {loading ? '-' : formatCompactNumber(rateStats.tokenCount)}
          </span>
        </>
      ),
      trend: (
        <div className={styles.statTrendSplit}>
          <div className={styles.statTrendSplitItem}>{renderSparkline(sparklines.rpm)}</div>
          <div className={styles.statTrendSplitItem}>{renderSparkline(sparklines.tpm)}</div>
        </div>
      ),
      className: styles.statCardWide,
    },
    {
      key: 'cost',
      label: t('usage_stats.total_cost'),
      icon: <IconDollarSign size={16} />,
      accent: '#f59e0b',
      accentSoft: 'rgba(245, 158, 11, 0.18)',
      accentBorder: 'rgba(245, 158, 11, 0.32)',
      value: loading ? '-' : pricedRequestCount > 0 ? formatUsd(totalCost) : '--',
      meta: (
        <>
          <span className={styles.statMetaItem}>
            {t('usage_stats.total_tokens')}:{' '}
            {loading ? '-' : formatCompactNumber(usage?.total_tokens ?? 0)}
          </span>
          {!hasPrices && (
            <span className={`${styles.statMetaItem} ${styles.statSubtle}`}>
              {t('usage_stats.cost_need_price')}
            </span>
          )}
          {hasPrices && unpricedRequestCount > 0 && (
            <span className={`${styles.statMetaItem} ${styles.statSubtle}`}>
              {t('usage_stats.cost_partial_notice')}
            </span>
          )}
          {hasPrices && pricedRequestCount === 0 && unpricedRequestCount === 0 && (
            <span className={`${styles.statMetaItem} ${styles.statSubtle}`}>
              {t('usage_stats.cost_need_usage')}
            </span>
          )}
        </>
      ),
      trend:
        hasPrices && pricedRequestCount > 0 ? (
          renderSparkline(sparklines.cost)
        ) : (
          <div className={styles.statTrendPlaceholder}></div>
        ),
      className: styles.statCardWide,
    },
  ];

  return (
    <div className={styles.statsGrid}>
      {statsCards.map((card) => (
        <div
          key={card.key}
          className={card.className ? `${styles.statCard} ${card.className}` : styles.statCard}
          style={
            {
              '--accent': card.accent,
              '--accent-soft': card.accentSoft,
              '--accent-border': card.accentBorder,
            } as CSSProperties
          }
        >
          <div className={styles.statCardHeader}>
            <div className={styles.statLabelGroup}>
              <span className={styles.statLabel}>{card.label}</span>
            </div>
            <span className={styles.statIconBadge}>{card.icon}</span>
          </div>
          <div className={styles.statValue}>{card.value}</div>
          {card.meta && <div className={styles.statMetaRow}>{card.meta}</div>}
          <div className={styles.statTrend}>{card.trend}</div>
        </div>
      ))}
    </div>
  );
}
