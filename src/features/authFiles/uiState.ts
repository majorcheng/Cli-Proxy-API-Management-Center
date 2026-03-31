import {
  DEFAULT_COMPACT_CARD_PAGE_SIZE,
  isLegacyDefaultCardPageSize,
  resolveAuthFilesPageSize,
} from '@/features/authFiles/pageSize';

export const AUTH_FILES_SORT_MODES = ['default', 'az', 'priority'] as const;

export type AuthFilesSortMode = (typeof AUTH_FILES_SORT_MODES)[number];

export type AuthFilesUiState = {
  filter?: string;
  problemOnly?: boolean;
  disabledOnly?: boolean;
  /**
   * 兼容旧版本：历史上曾支持普通/简略双模式切换。
   * 现在页面已固定为简略模式，但仍保留这些字段读取迁移旧会话设置。
   */
  compactMode?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
  regularPageSize?: number;
  compactPageSize?: number;
  sortMode?: AuthFilesSortMode;
};

const AUTH_FILES_UI_STATE_KEY = 'authFilesPage.uiState';
const AUTH_FILES_SORT_MODE_SET = new Set<AuthFilesSortMode>(AUTH_FILES_SORT_MODES);
export const DEFAULT_AUTH_FILES_PAGE_SIZE = DEFAULT_COMPACT_CARD_PAGE_SIZE;

export const isAuthFilesSortMode = (value: unknown): value is AuthFilesSortMode =>
  typeof value === 'string' && AUTH_FILES_SORT_MODE_SET.has(value as AuthFilesSortMode);

/**
 * 认证文件页已收口为单一紧凑布局。
 * 分页大小优先继承旧版的简略分页设置；若该值只是历史默认值，则继续回退到
 * pageSize / regularPageSize，尽量减少升级后“页大小突然变化”的体感。
 */
export const resolvePersistedAuthFilesPageSize = (
  state: AuthFilesUiState | null | undefined
): number => {
  if (!state) {
    return DEFAULT_AUTH_FILES_PAGE_SIZE;
  }

  const orderedCandidates = [state.compactPageSize, state.pageSize, state.regularPageSize];
  const preferredCandidate = orderedCandidates.find(
    (value) => typeof value === 'number' && Number.isFinite(value) && !isLegacyDefaultCardPageSize(value)
  );

  if (preferredCandidate !== undefined) {
    return resolveAuthFilesPageSize(preferredCandidate, DEFAULT_AUTH_FILES_PAGE_SIZE);
  }

  const fallbackCandidate = orderedCandidates.find(
    (value) => typeof value === 'number' && Number.isFinite(value)
  );

  return resolveAuthFilesPageSize(fallbackCandidate, DEFAULT_AUTH_FILES_PAGE_SIZE);
};

export const readAuthFilesUiState = (): AuthFilesUiState | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(AUTH_FILES_UI_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthFilesUiState;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

export const writeAuthFilesUiState = (state: AuthFilesUiState) => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(AUTH_FILES_UI_STATE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
};
