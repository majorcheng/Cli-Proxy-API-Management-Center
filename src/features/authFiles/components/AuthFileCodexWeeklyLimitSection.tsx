import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatQuotaResetTime } from '@/utils/quota';
import type { AuthFileItem } from '@/types';
import { QuotaProgressBar } from '@/features/authFiles/components/QuotaProgressBar';
import { resolveCodexWeeklyLimit } from '@/features/authFiles/codexWeeklyLimit';
import styles from '@/pages/AuthFilesPage.module.scss';

export type AuthFileCodexWeeklyLimitSectionProps = {
  file: AuthFileItem;
};

const REFRESH_INTERVAL_MS = 30 * 1000;

export function AuthFileCodexWeeklyLimitSection(props: AuthFileCodexWeeklyLimitSectionProps) {
  const { file } = props;
  const { t } = useTranslation();
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const weeklyLimit = useMemo(() => resolveCodexWeeklyLimit(file, nowMs), [file, nowMs]);

  if (!weeklyLimit.applicable) return null;

  const absoluteRecoveryTime = weeklyLimit.recoveryAtIso
    ? formatQuotaResetTime(weeklyLimit.recoveryAtIso)
    : '-';

  let primaryText = weeklyLimit.countdownLabel;
  let tooltipRecoveryText = '';
  const percentText =
    weeklyLimit.progressPercent === null ? '--' : `${Math.round(weeklyLimit.progressPercent)}%`;

  if (weeklyLimit.kind === 'limited') {
    tooltipRecoveryText = t('auth_files.weekly_429_recovery_at', { time: absoluteRecoveryTime });
  } else if (weeklyLimit.kind === 'clear') {
    primaryText = t('auth_files.weekly_429_clear');
  } else if (weeklyLimit.kind === 'unknown') {
    primaryText = t('auth_files.weekly_429_hit');
  } else if (weeklyLimit.kind === 'expired') {
    primaryText = t('auth_files.weekly_429_expired');
  }

  const titleText = `${t('auth_files.weekly_429_limit')} · ${percentText} · ${primaryText}${
    tooltipRecoveryText ? ` · ${tooltipRecoveryText}` : ''
  }${weeklyLimit.kind === 'unknown' ? ` · ${t('auth_files.weekly_429_unknown')}` : ''}${
    weeklyLimit.kind === 'expired' ? ` · ${t('auth_files.weekly_429_wait_refresh')}` : ''
  }`;

  return (
    <div className={styles.codexWeeklyLimitInline} title={titleText}>
      <div className={styles.codexWeeklyLimitBarWrap}>
        <QuotaProgressBar
          percent={weeklyLimit.progressPercent}
          highThreshold={80}
          mediumThreshold={50}
          invertThresholds={true}
        />
      </div>
      <div className={styles.codexWeeklyLimitMeta}>
        <span className={styles.codexWeeklyLimitPercent}>{percentText}</span>
        <span className={styles.codexWeeklyLimitDivider}>·</span>
        <span className={styles.codexWeeklyLimitSummary}>{primaryText}</span>
      </div>
    </div>
  );
}
