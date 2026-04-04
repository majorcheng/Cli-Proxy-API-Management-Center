import { useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiDetailsCard } from '@/components/usage/ApiDetailsCard';
import { TimeRangeSelector, formatTimeRangeCaption, type TimeRange } from './TimeRangeSelector';
import {
  filterDataByTimeRange,
  type DateRange,
} from '@/utils/monitor';
import {
  getApiStats,
  loadModelPrices,
} from '@/utils/usage';
import type { UsageData } from '@/pages/MonitorPage';
import styles from '@/pages/MonitorPage.module.scss';

interface ApiDetailsStatsCardProps {
  data: UsageData | null;
  loading: boolean;
}

export function ApiDetailsStatsCard({ data, loading }: ApiDetailsStatsCardProps) {
  const { t } = useTranslation();
  const [timeRange, setTimeRange] = useState<TimeRange>(1);
  const [customRange, setCustomRange] = useState<DateRange | undefined>();

  const handleTimeRangeChange = useCallback((range: TimeRange, custom?: DateRange) => {
    setTimeRange(range);
    if (custom) {
      setCustomRange(custom);
    }
  }, []);

  const timeFilteredData = useMemo(() => {
    return filterDataByTimeRange(data, timeRange, customRange);
  }, [data, timeRange, customRange]);

  // 与使用统计页共用同一份本地价格配置，避免两边口径不一致。
  const modelPrices = useMemo(() => loadModelPrices(), []);
  const hasModelPrices = Object.keys(modelPrices).length > 0;

  const apiStats = useMemo(() => {
    return getApiStats(timeFilteredData, modelPrices);
  }, [timeFilteredData, modelPrices]);

  return (
    <ApiDetailsCard
      apiStats={apiStats}
      loading={loading}
      hasPrices={hasModelPrices}
      cardClassName={styles.monitorApiDetailsCard}
      subtitle={formatTimeRangeCaption(timeRange, customRange, t)}
      extra={
        <TimeRangeSelector
          value={timeRange}
          onChange={handleTimeRangeChange}
          customRange={customRange}
        />
      }
      showLatestClientIp
    />
  );
}
