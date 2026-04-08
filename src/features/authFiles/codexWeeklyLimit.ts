export type CodexWeeklyLimitKind = 'clear' | 'limited' | 'unknown' | 'expired';

export type CodexWeeklyLimitView = {
  applicable: boolean;
  is429Limited: boolean;
  kind: CodexWeeklyLimitKind;
  recoveryAtIso: string | null;
  progressPercent: number | null;
  countdownLabel: string;
};

export type AuthFileUsedTokensWindow = {
  startMs: number;
  endMs: number;
  kind: 'rolling_7d' | 'codex_previous_weekly_cycle';
};

type AuthFileLike = {
  provider?: unknown;
  type?: unknown;
  status_message?: unknown;
  statusMessage?: unknown;
  next_retry_after?: unknown;
  nextRetryAfter?: unknown;
  updated_at?: unknown;
  updatedAt?: unknown;
  modified?: unknown;
  [key: string]: unknown;
};

type JsonRecord = Record<string, unknown>;

const EMPTY_RESULT: CodexWeeklyLimitView = {
  applicable: false,
  is429Limited: false,
  kind: 'clear',
  recoveryAtIso: null,
  progressPercent: 0,
  countdownLabel: '未命中',
};

const WEEK_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const normalizeString = (value: unknown): string => {
  if (typeof value === 'string') return value.trim();
  if (value == null) return '';
  return String(value).trim();
};

const isRecord = (value: unknown): value is JsonRecord =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const readStatusMessage = (file: AuthFileLike): string =>
  normalizeString(file.status_message ?? file.statusMessage);

const parseStatusPayload = (value: string): JsonRecord | null => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const parseDateLike = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value < 1e12 ? value * 1000 : value;
  }
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const asNumber = Number(trimmed);
  if (Number.isFinite(asNumber) && asNumber > 0) {
    return asNumber < 1e12 ? asNumber * 1000 : asNumber;
  }
  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
};

const parsePositiveNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const parseUnixSecondsLike = (value: unknown): number | null => {
  const parsed = parsePositiveNumber(value);
  if (parsed === null) return null;
  return parsed < 1e12 ? parsed * 1000 : parsed;
};

const resolveProviderKey = (file: AuthFileLike): string =>
  normalizeString(file.provider || file.type).toLowerCase();

const resolveFileUpdatedAtMs = (file: AuthFileLike): number | null =>
  parseDateLike(file.updated_at ?? file.updatedAt) ?? parseDateLike(file.modified);

export function formatCompactDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return 'lt1m';
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) return 'lt1m';

  const totalMinutes = Math.floor(totalSeconds / 60);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return hours > 0 ? `${days}d${hours}h` : `${days}d`;
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours}h${minutes}m` : `${hours}h`;
  }
  return `${minutes}m`;
}

export function resolveCodexWeeklyLimit(file: AuthFileLike, nowMs: number = Date.now()): CodexWeeklyLimitView {
  if (resolveProviderKey(file) !== 'codex') {
    return EMPTY_RESULT;
  }

  const rawStatusMessage = readStatusMessage(file);
  const payload = parseStatusPayload(rawStatusMessage);
  const error = payload && isRecord(payload.error) ? payload.error : null;
  const errorType = normalizeString(error?.type).toLowerCase();

  if (errorType !== 'usage_limit_reached') {
    return {
      applicable: true,
      is429Limited: false,
      kind: 'clear',
      recoveryAtIso: null,
      progressPercent: 0,
      countdownLabel: '未命中',
    };
  }

  const updatedAtMs =
    parseDateLike(file.updated_at ?? file.updatedAt) ?? parseDateLike(file.modified);
  const nextRetryAfterMs = parseDateLike(file.next_retry_after ?? file.nextRetryAfter);
  const resetsAtMs = parseUnixSecondsLike(error?.resets_at);
  const resetsInMsRaw = parsePositiveNumber(error?.resets_in_seconds);
  const resetsInMs = resetsInMsRaw === null ? null : resetsInMsRaw * 1000;

  let recoveryAtMs = nextRetryAfterMs ?? resetsAtMs;
  if (recoveryAtMs === null && resetsInMs !== null) {
    recoveryAtMs = updatedAtMs !== null ? updatedAtMs + resetsInMs : nowMs + resetsInMs;
  }

  if (recoveryAtMs === null) {
    return {
      applicable: true,
      is429Limited: true,
      kind: 'unknown',
      recoveryAtIso: null,
      progressPercent: null,
      countdownLabel: '已命中',
    };
  }

  if (recoveryAtMs <= nowMs) {
    return {
      applicable: true,
      is429Limited: true,
      kind: 'expired',
      recoveryAtIso: new Date(recoveryAtMs).toISOString(),
      progressPercent: 0,
      countdownLabel: '已到期',
    };
  }

  let progressPercent: number | null = null;
  if (resetsInMs !== null && resetsInMs > 0) {
    const remainingMs = clamp(recoveryAtMs - nowMs, 0, resetsInMs);
    progressPercent = clamp((remainingMs / resetsInMs) * 100, 0, 100);
  } else if (updatedAtMs !== null && recoveryAtMs > updatedAtMs) {
    const totalMs = recoveryAtMs - updatedAtMs;
    const remainingMs = clamp(recoveryAtMs - nowMs, 0, totalMs);
    progressPercent = clamp((remainingMs / totalMs) * 100, 0, 100);
  }

  return {
    applicable: true,
    is429Limited: true,
    kind: 'limited',
    recoveryAtIso: new Date(recoveryAtMs).toISOString(),
    progressPercent,
    countdownLabel: formatCompactDuration(recoveryAtMs - nowMs),
  };
}

export function resolveAuthFileUsedTokensWindow(
  file: AuthFileLike,
  nowMs: number = Date.now()
): AuthFileUsedTokensWindow {
  const rollingWindow: AuthFileUsedTokensWindow = {
    startMs: Math.max(0, nowMs - WEEK_WINDOW_MS),
    endMs: nowMs,
    kind: 'rolling_7d',
  };

  if (resolveProviderKey(file) !== 'codex') {
    return rollingWindow;
  }

  const weeklyLimit = resolveCodexWeeklyLimit(file, nowMs);
  if (!weeklyLimit.is429Limited) {
    return rollingWindow;
  }

  // Codex 命中 429 周限时，“已用”要看上一整个周限周期，而不是继续累计到当前时间。
  // 有 recoveryAt 时按 recoveryAt 往前回溯 7 天；否则退回到文件最近一次状态更新时间。
  const cycleEndMs =
    parseDateLike(weeklyLimit.recoveryAtIso) ?? resolveFileUpdatedAtMs(file) ?? nowMs;

  return {
    startMs: Math.max(0, cycleEndMs - WEEK_WINDOW_MS),
    endMs: cycleEndMs,
    kind: 'codex_previous_weekly_cycle',
  };
}
