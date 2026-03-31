import styles from '@/pages/AuthFilesPage.module.scss';

export type QuotaProgressBarProps = {
  percent: number | null;
  highThreshold: number;
  mediumThreshold: number;
  invertThresholds?: boolean;
};

export function QuotaProgressBar({
  percent,
  highThreshold,
  mediumThreshold,
  invertThresholds = false,
}: QuotaProgressBarProps) {
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  const normalized = percent === null ? null : clamp(percent, 0, 100);
  const fillClass =
    normalized === null
      ? styles.quotaBarFillMedium
      : invertThresholds
        ? normalized >= highThreshold
          ? styles.quotaBarFillLow
          : normalized >= mediumThreshold
            ? styles.quotaBarFillMedium
            : styles.quotaBarFillHigh
        : normalized >= highThreshold
          ? styles.quotaBarFillHigh
          : normalized >= mediumThreshold
            ? styles.quotaBarFillMedium
            : styles.quotaBarFillLow;
  const widthPercent =
    normalized === null ? 0 : normalized > 0 ? Math.max(normalized, 2) : 0;

  return (
    <div className={styles.quotaBar}>
      <div className={`${styles.quotaBarFill} ${fillClass}`} style={{ width: `${widthPercent}%` }} />
    </div>
  );
}
