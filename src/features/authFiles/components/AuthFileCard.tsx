import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { SelectionCheckbox } from '@/components/ui/SelectionCheckbox';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import {
  IconDownload,
  IconInfo,
  IconModelCluster,
  IconSettings,
  IconTrash2,
} from '@/components/ui/icons';
import { ProviderStatusBar } from '@/components/providers/ProviderStatusBar';
import type { AuthFileItem } from '@/types';
import { resolveAuthProvider } from '@/utils/quota';
import {
  calculateStatusBarData,
  formatCompactNumber,
  normalizeAuthIndex,
  type KeyStats
} from '@/utils/usage';
import { formatFileSize } from '@/utils/format';
import {
  QUOTA_PROVIDER_TYPES,
  formatModifiedCompact,
  formatModified,
  getAuthFileIcon,
  getAuthFileStatusMessage,
  getTypeColor,
  getTypeLabel,
  isRuntimeOnlyAuthFile,
  parsePriorityValue,
  resolveAuthFileStats,
  type QuotaProviderType,
  type ResolvedTheme,
} from '@/features/authFiles/constants';
import type { AuthFileStatusBarData } from '@/features/authFiles/hooks/useAuthFilesStatusBarCache';
import { AuthFileCodexWeeklyLimitSection } from '@/features/authFiles/components/AuthFileCodexWeeklyLimitSection';
import { resolveCodexWeeklyLimit } from '@/features/authFiles/codexWeeklyLimit';
import styles from '@/pages/AuthFilesPage.module.scss';

const HEALTHY_STATUS_MESSAGES = new Set(['ok', 'healthy', 'ready', 'success', 'available']);

export type AuthFileCardProps = {
  file: AuthFileItem;
  selected: boolean;
  resolvedTheme: ResolvedTheme;
  disableControls: boolean;
  deleting: string | null;
  statusUpdating: Record<string, boolean>;
  keyStats: KeyStats;
  statusBarCache: Map<string, AuthFileStatusBarData>;
  onShowModels: (file: AuthFileItem) => void;
  onDownload: (name: string) => void;
  onOpenPrefixProxyEditor: (file: AuthFileItem) => void;
  onDelete: (name: string) => void;
  onToggleStatus: (file: AuthFileItem, enabled: boolean) => void;
  onToggleSelect: (name: string) => void;
};

const resolveQuotaType = (file: AuthFileItem): QuotaProviderType | null => {
  const provider = resolveAuthProvider(file);
  if (!QUOTA_PROVIDER_TYPES.has(provider as QuotaProviderType)) return null;
  return provider as QuotaProviderType;
};

export function AuthFileCard(props: AuthFileCardProps) {
  const { t } = useTranslation();
  const {
    file,
    selected,
    resolvedTheme,
    disableControls,
    deleting,
    statusUpdating,
    keyStats,
    statusBarCache,
    onShowModels,
    onDownload,
    onOpenPrefixProxyEditor,
    onDelete,
    onToggleStatus,
    onToggleSelect,
  } = props;

  const fileStats = resolveAuthFileStats(file, keyStats);
  const isRuntimeOnly = isRuntimeOnlyAuthFile(file);
  const isAistudio = (file.type || '').toLowerCase() === 'aistudio';
  const providerKey = resolveAuthProvider(file);
  const isCodexAuthFile = providerKey === 'codex' && !isRuntimeOnly;
  const showModelsButton = (!isRuntimeOnly || isAistudio) && !isCodexAuthFile;
  const typeColor = getTypeColor(file.type || 'unknown', resolvedTheme);
  const typeLabel = getTypeLabel(t, file.type || 'unknown');
  const providerIcon = getAuthFileIcon(file.type || 'unknown', resolvedTheme);
  const codexWeeklyLimit = isCodexAuthFile ? resolveCodexWeeklyLimit(file) : null;

  const quotaType = resolveQuotaType(file);

  const providerCardClass =
    quotaType === 'antigravity'
      ? styles.antigravityCard
      : quotaType === 'claude'
        ? styles.claudeCard
        : quotaType === 'codex'
          ? styles.codexCard
          : quotaType === 'gemini-cli'
            ? styles.geminiCliCard
            : quotaType === 'kimi'
              ? styles.kimiCard
              : '';

  const rawAuthIndex = file['auth_index'] ?? file.authIndex;
  const authIndexKey = normalizeAuthIndex(rawAuthIndex);
  const statusData =
    (authIndexKey && statusBarCache.get(authIndexKey)) || calculateStatusBarData([]);
  const rawStatusMessage = getAuthFileStatusMessage(file);
  const hasStatusWarning =
    Boolean(rawStatusMessage) && !HEALTHY_STATUS_MESSAGES.has(rawStatusMessage.toLowerCase());
  const showRawStatusMessage = hasStatusWarning && !codexWeeklyLimit?.is429Limited;

  const priorityValue = parsePriorityValue(file.priority ?? file['priority']);
  const noteValue = typeof file.note === 'string' ? file.note.trim() : '';
  const modifiedCompact = formatModifiedCompact(file);
  const fileSizeCompact = file.size ? formatFileSize(file.size) : '-';
  const fileNameTitle = noteValue
    ? `${file.name}\n${t('auth_files.note_display')}: ${noteValue}`
    : file.name;
  const usedTokensTitle = `${t('auth_files.tokens_used')}: ${fileStats.totalTokens.toLocaleString()}`;
  const stateLabel = isRuntimeOnly
    ? t('auth_files.type_virtual') || '虚拟认证文件'
    : file.disabled
      ? t('auth_files.health_status_disabled')
      : hasStatusWarning
        ? t('auth_files.health_status_warning')
        : rawStatusMessage
          ? t('auth_files.health_status_healthy')
          : t('auth_files.status_toggle_label');
  const stateBadgeClass = isRuntimeOnly
    ? styles.stateBadgeVirtual
    : file.disabled
      ? styles.stateBadgeDisabled
      : hasStatusWarning
        ? styles.stateBadgeWarning
        : styles.stateBadgeActive;

  return (
    <div
      className={`${styles.fileCard} ${styles.fileCardCompact} ${providerCardClass} ${selected ? styles.fileCardSelected : ''} ${file.disabled ? styles.fileCardDisabled : ''}`}
    >
      <div className={styles.fileCardLayout}>
        <div className={styles.fileCardMain}>
          <div className={styles.cardHeader}>
            {!isRuntimeOnly && (
              <SelectionCheckbox
                checked={selected}
                onChange={() => onToggleSelect(file.name)}
                className={styles.cardSelection}
                aria-label={
                  selected ? t('auth_files.batch_deselect') : t('auth_files.batch_select_all')
                }
                title={selected ? t('auth_files.batch_deselect') : t('auth_files.batch_select_all')}
              />
            )}
            <div
              className={styles.providerAvatar}
              style={{
                backgroundColor: typeColor.bg,
                color: typeColor.text,
                ...(typeColor.border ? { border: typeColor.border } : {}),
              }}
            >
              {providerIcon ? (
                <img src={providerIcon} alt="" className={styles.providerAvatarImage} />
              ) : (
                <span className={styles.providerAvatarFallback}>
                  {typeLabel.slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
            <div className={styles.cardHeaderContent}>
              <div className={styles.cardBadgeRow}>
                <span
                  className={styles.typeBadge}
                  style={{
                    backgroundColor: typeColor.bg,
                    color: typeColor.text,
                    ...(typeColor.border ? { border: typeColor.border } : {}),
                  }}
                >
                  {typeLabel}
                </span>
                <span
                  className={styles.headerMetaChip}
                  title={`${t('auth_files.file_size')}: ${fileSizeCompact}`}
                >
                  {fileSizeCompact}
                </span>
                <span
                  className={styles.headerMetaChip}
                  title={`${t('auth_files.file_modified')}: ${formatModified(file)}`}
                >
                  {modifiedCompact}
                </span>
                {priorityValue !== undefined && (
                  <span
                    className={`${styles.headerMetaChip} ${styles.headerMetaChipStrong}`}
                    title={`${t('auth_files.priority_display')}: ${priorityValue}`}
                  >
                    P{priorityValue}
                  </span>
                )}
                <span className={`${styles.stateBadge} ${stateBadgeClass}`}>{stateLabel}</span>
              </div>
              <div className={styles.fileNameRow}>
                <span className={styles.fileName} title={fileNameTitle}>
                  {file.name}
                </span>
                {!isRuntimeOnly && (
                  <div className={`${styles.statusToggle} ${styles.statusToggleHeader}`}>
                    <span className={styles.statusToggleLabel}>
                      {t('auth_files.status_toggle_label')}
                    </span>
                    <ToggleSwitch
                      ariaLabel={t('auth_files.status_toggle_label')}
                      checked={!file.disabled}
                      disabled={disableControls || statusUpdating[file.name] === true}
                      onChange={(value) => onToggleStatus(file, value)}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {showRawStatusMessage && hasStatusWarning && (
            <div className={styles.healthStatusMessage} title={rawStatusMessage}>
              <IconInfo className={styles.messageIcon} size={14} />
              <span>{rawStatusMessage}</span>
            </div>
          )}

          <div className={`${styles.cardInsights} ${styles.cardInsightsCompact}`}>
            <div className={`${styles.cardStats} ${styles.cardStatsCompact}`}>
              <div className={`${styles.statPill} ${styles.statSuccess}`}>
                <span className={styles.statLabel}>{t('stats.success')}</span>
                <span className={styles.statValue}>{fileStats.success}</span>
              </div>
              <div className={`${styles.statPill} ${styles.statFailure}`}>
                <span className={styles.statLabel}>{t('stats.failure')}</span>
                <span className={styles.statValue}>{fileStats.failure}</span>
              </div>
              <div className={`${styles.statPill} ${styles.statTokens}`} title={usedTokensTitle}>
                <span className={styles.statLabel}>{t('auth_files.tokens_used')}</span>
                <span className={styles.statValue}>{formatCompactNumber(fileStats.totalTokens)}</span>
              </div>
            </div>

            <div className={`${styles.statusPanel} ${styles.statusPanelCompact}`}>
              <div className={styles.statusPanelLabel}>
                <span>{t('auth_files.health_status_label')}</span>
              </div>
              <ProviderStatusBar statusData={statusData} styles={styles} />
            </div>
          </div>

          <div className={styles.cardActions}>
            <div className={styles.cardActionsMain}>
              {isCodexAuthFile && <AuthFileCodexWeeklyLimitSection file={file} />}
              {showModelsButton && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onShowModels(file)}
                  className={`${styles.primaryActionButton} ${styles.modelsActionButton}`}
                  title={t('auth_files.models_button', { defaultValue: '模型' })}
                  disabled={disableControls}
                >
                  <>
                    <span className={styles.modelsActionIconWrap}>
                      <IconModelCluster className={styles.actionIcon} size={16} />
                    </span>
                    <span className={styles.actionButtonLabel}>
                      {t('auth_files.models_button', { defaultValue: '模型' })}
                    </span>
                  </>
                </Button>
              )}
              {!isRuntimeOnly && (
                <div className={styles.cardUtilityActions}>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onDownload(file.name)}
                    className={styles.iconButton}
                    title={t('auth_files.download_button')}
                    disabled={disableControls}
                  >
                    <IconDownload className={styles.actionIcon} size={16} />
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onOpenPrefixProxyEditor(file)}
                    className={styles.iconButton}
                    title={t('auth_files.prefix_proxy_button')}
                    disabled={disableControls}
                  >
                    <IconSettings className={styles.actionIcon} size={16} />
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => onDelete(file.name)}
                    className={styles.iconButton}
                    title={t('auth_files.delete_button')}
                    disabled={disableControls || deleting === file.name}
                  >
                    {deleting === file.name ? (
                      <LoadingSpinner size={14} />
                    ) : (
                      <IconTrash2 className={styles.actionIcon} size={16} />
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
